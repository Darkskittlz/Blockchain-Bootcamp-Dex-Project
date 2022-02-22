import { tokens, EVM_REVERT, ether } from './helpers'

const Exchange = artifacts.require('./Exchange')
const Token = artifacts.require('./Token')

require('chai')
    .use(require('chai-as-promised'))
    .should()


contract('Exchange', ([deployer, feeAccount, user1, user2]) => {
    let token
    let exchange 
    const feePercent = 10

    beforeEach(async () => {
        // Deploy Token 
        token = await Token.new()

        // Transfer tokens to user1 
        token.transfer(user1, tokens(100), { from: deployer })

        // Deploy Exchange
        exchange = await Exchange.new(feeAccount, feePercent)
    })

  describe('deployment', () => {
      it('tracks the name', async () => {
          const result = await exchange.feeAccount()
          result.should.equal(feeAccount)
      })

      it('tracks the fee percent', async () => {
          const result = await exchange.feePercent()
          result.toString().should.equal(feePercent.toString())
      })
 
  })

  describe('fallback', () => {
      it('reverts when Ether is sent', async () => {
          await exchange.sendTransaction({ value: 1, from: user1 }).should.be.rejectedWith(EVM_REVERT)
      })
  })

  describe('depositing Ether', async() => {
    let result
    let amount

    beforeEach(async () => {
        amount = ether(1)
        result = await exchange.depositEther({ from: user1, value: amount })
    })

    it('tracks the ether deposit', async () => {
        const balance = await exchange.tokens('0x0000000000000000000000000000000000000000', user1)
        balance.toString().should.equal(amount.toString())
    })

    it('emits a Deposit event', () => {
        const log = result.logs[0]
        log.event.should.eq('Deposit')
        const event = log.args
        event.token.toString().should.equal('0x0000000000000000000000000000000000000000', 'Token address is correct')
        event.user.should.equal(user1, 'user address is correct')
        event.amount.toString().should.equal(amount.toString(), 'amount is correct')
        event.balance.toString().should.equal(amount.toString(), 'balance is correct')
    })
  })

  describe('withdrawing Ether', async () => {
    let result
    let amount

    beforeEach(async () => {
        // Deposit Ether first 
        amount = ether(1)
        await exchange.depositEther({ from: user1, value: amount })
    })

    describe('success', async () => {
        beforeEach(async () => {
            // Withdraw Ether
            result = await exchange.withdrawEther(amount, { from: user1 })
        })

        it('withdraws Ether funds', async () => {
            const balance = await exchange.tokens('0x0000000000000000000000000000000000000000', user1)
            balance.toString().should.equal('0')
        })

        it('emits a withdraw event', async () => {
            const log = result.logs[0]
            log.event.should.eq('Withdraw')
            const event = log.args
            event.token.toString().should.equal('0x0000000000000000000000000000000000000000', 'ETHER address is correct')
            event.user.should.equal(user1)
            event.amount.toString().should.equal(amount.toString())
            event.balance.toString().should.equal('0')
        })
    })

    describe('failure', async () => {
        it('rejects withdraws for insufficient balances of Ether', async () => {
            await exchange.withdrawEther(ether(100), { from: user1 }).should.be.rejectedWith(EVM_REVERT)
        })
    })
  
  })

  describe('depositing tokens', () => {
        let result
        let amount

      describe('success', () => {
        beforeEach(async () => {
            amount = tokens(10)
            await token.approve(exchange.address, amount, { from: user1 })
            result = await exchange.depositToken(token.address, amount, { from: user1 })
        })
          it('tracks the token deposit', async () => {
            //Check exchange token balance 
            let balance  
            balance = await token.balanceOf(exchange.address)
            balance.toString().should.equal(amount.toString())
            //Check tokens on exchange
            balance = await exchange.tokens(token.address, user1)
            balance.toString().should.equal(amount.toString())
          })

          it('emits a Deposit event', () => {
            const log = result.logs[0]
            log.event.should.eq('Deposit')
            const event = log.args
            event.token.toString().should.equal(token.address, 'Token address is correct')
            event.user.should.equal(user1, 'user address is correct')
            event.amount.toString().should.equal(amount.toString(), 'amount is correct')
            event.balance.toString().should.equal(amount.toString(), 'balance is correct')
        })
      })

      describe('failure', () => {        
          it('rejects Ether deposits', async () => {
              await exchange.depositToken('0x0000000000000000000000000000000000000000', tokens(10), { from: user1 }).should.be.rejectedWith(EVM_REVERT)
          })

          it('fails when no tokens are approved', async () => {
              await exchange.depositToken(token.address, tokens(10), { from: user1 }).should.be.rejectedWith(EVM_REVERT)
          })
      })
  })

    describe('withdrawing tokens', async => {
      let result 
      let amount 

        describe('success', async () => {
            beforeEach(async () => {
              //Deposit Tokens first: Two step process
              amount = tokens(10)
              //Step 1: Tokens are approved
              await token.approve(exchange.address, amount, { from: user1 })
              //Step2: Tokens are deposited
              await exchange.depositToken(token.address, amount, { from: user1 })

              //Withdraw Tokens 
              result = await exchange.withdrawToken(token.address, amount, { from: user1 })
            })

            it('withdraws token funds', async () => {
              //Check balance
              const balance = await exchange.tokens(token.address, user1)
              balance.toString().should.equal('0')
            })

            it('emits a withdraw event', async () => {
                const log = result.logs[0]
                log.event.should.eq('Withdraw')
                const event = log.args
                event.token.toString().should.equal(token.address)
                event.user.should.equal(user1)
                event.amount.toString().should.equal(amount.toString())
                event.balance.toString().should.equal('0')          })
            })

      

        describe('failure', async () => {
            it('rejects Ether withdraw', async() => {
                await exchange.withdrawToken('0x0000000000000000000000000000000000000000', tokens(10), { from: user1}).should.be.rejectedWith(EVM_REVERT)
            })

            it('fails for insufficient balance', async () => {
                await exchange.withdrawToken(token.address, tokens(10), { from: user1 }).should.be.rejectedWith(EVM_REVERT)
            })
        })
    })

    describe('checking balances', async () => {
        beforeEach(async () => {
            //Deposits 1 Ether
            exchange.depositEther({ from: user1, value: ether(1) })
        })

        it('returns user balance', async () => {
          const result = await exchange.balanceOf('0x0000000000000000000000000000000000000000', user1)
          //The result of the balance of user1 should equal this same amount
          result.toString().should.equal(ether(1).toString())
        })
    })

    describe('making orders', async () => {
        let result

        beforeEach(async () => {
            result = await exchange.makeOrder(token.address, tokens(1), '0x0000000000000000000000000000000000000000', ether(1), { from: user1 })
        })

        it('tracks the newly created order', async () => {
            //Sets order count to 1
            const orderCount = await exchange.orderCount()
            //Fetches orderCount from exchange which should equal 1
            orderCount.toString().should.equal('1')
            const order = await exchange.orders('1')
            order.id.toString().should.equal('1', 'id is correct')
            order.user.should.equal(user1, 'user is correct')
            order.tokenGet.should.equal(token.address, 'tokenGet is correct')
            order.amountGet.toString().should.equal(tokens(1).toString(), 'amountGet is correct')
            order.tokenGive.should.equal('0x0000000000000000000000000000000000000000', 'tokenGive is correct')
            order.amountGive.toString().should.equal(ether(1).toString(), 'amountGive is correct')
            order.timestamp.toString().length.should.be.at.least(1, 'timestamp is present')
        })

        it('emits an "Order" event', async () => {
            const log = result.logs[0]
            log.event.should.eq('Order')
            const event = log.args
            event.id.toString().should.equal('1', 'id is correct')
            event.user.should.equal(user1, 'user address is correct')
            event.tokenGet.should.equal(token.address, 'tokenGet is correct')
            event.amountGet.toString().should.equal(tokens(1).toString(), 'amountGet is correct')
            event.tokenGive.should.equal('0x0000000000000000000000000000000000000000', 'tokenGive is correct')
            event.amountGive.toString().should.equal(ether(1).toString(), 'amountGive is correct')
            event.timestamp.toString().length.should.be.at.least(1, 'timestamp is present')
        })
    })

    describe('order actions', async () => {
        beforeEach(async () => {
            //user1 deposits 1 ether only on the exchange
            await exchange.depositEther({ from: user1, value: ether(1) })
            //give tokens to user2
            await token.transfer(user2, tokens(100), { from: deployer })
            //userr2 deposits tokens only
            await token.approve(exchange.address, tokens(2), { from: user2 })
            await exchange.depositToken(token.address, tokens(2), { from: user2 })
            //user1 makes an order to buy tokens with Ether
            await exchange.makeOrder(token.address, tokens(1), '0x0000000000000000000000000000000000000000', ether(1), { from: user1 })
        })

        describe('filling orders', async () => {
            let result

            describe('success', async () => {
                beforeEach(async () => {
                    // user2 fills order. The result is the filled order by user2 with id='1', since I've only filled one order at this point.
                    result = await exchange.fillOrder('1', { from: user2 })
                })

                //Tests that the trade is executed and that it charges the fees. 
                // 1. gets balance of tokens for user1
                // 2. balance should equal 1 token received
                // 3. Gets balance of user2
                // 4. Tests to see that user2 received 1 ether
                // 5. Tests to see that user1 had ether deducted
                // 6. Tokens were deducted from user2 and the fee was applied 
                // 7. Fee Account has fee applied to it, which is 10% of the trade.
                it('executes the trade & charges fees', async () => {
                    let balance
                    balance = await exchange.balanceOf(token.address, user1)
                    balance.toString().should.equal(tokens(1).toString(), 'user1 received tokens')
                    balance = await exchange.balanceOf('0x0000000000000000000000000000000000000000', user2)
                    balance.toString().should.equal(ether(1).toString(), 'user2 received Ether')
                    balance = await exchange.balanceOf('0x0000000000000000000000000000000000000000', user1)
                    balance.toString().should.equal('0', 'user1 Ether deducted')
                    balance = await exchange.balanceOf(token.address, user2)
                    balance.toString().should.equal(tokens(0.9).toString(), 'user2 tokens deducted with fee applied')
                    const feeAccount = await exchange.feeAccount()
                    balance = await exchange.balanceOf(token.address, feeAccount)
                    balance.toString().should.equal(tokens(0.1).toString(), 'feeAccount received fee')
                })

                it('updates filled orders', async () => {
                    const orderFilled = await exchange.orderFilled(1)
                    orderFilled.should.equal(true)
                })

                it('emits a "Trade" event', async () => {
                    const log = result.logs[0]
                    log.event.should.eq('Trade')
                    const event = log.args
                    event.id.toString().should.equal('1', 'id is correct')
                    event.user.should.equal(user1, 'user is correct')
                    event.tokenGet.should.equal(token.address, 'tokenGet is correct')
                    event.amountGet.toString().should.equal(tokens(1).toString(), 'amountGet is correct')
                    event.tokenGive.should.equal('0x0000000000000000000000000000000000000000', 'tokenGive is correct')
                    event.amountGive.toString().should.equal(ether(1).toString(), 'amountGive is correct')
                    event.userFill.should.equal(user2, 'userFill is correct')
                    event.timestamp.toString().length.should.be.at.least(1, 'timestamp is present')
                })
            })

            describe('failure', async () => {

                it('rejects invalid order ids', async () => {
                    const invalidOrderId = 99999
                    await exchange.fillOrder(invalidOrderId, { from: user2 }).should.be.rejectedWith(EVM_REVERT)
                })

                it('rejects already-filled orders', async () => {
                    // Fill the order
                    await exchange.fillOrder('1', { from: user2 }).should.be.fulfilled
                    //Try to fill it again
                    await exchange.fillOrder('1', { from: user2 }).should.be.rejectedWith(EVM_REVERT)
                })

                it('rejects cancelled orders', async () => {
                    //Cancel the order
                    await exchange.cancelOrder('1', { from: user1 }).should.be.fulfilled
                    //Try to fill the order
                    await exchange.fillOrder('1', { from: user2 }).should.be.rejectedWith(EVM_REVERT)
                })
            })
        })

        describe('cancelling orders', async () => {
            let result 

            describe('success', async () => {
                beforeEach(async () => {
                    result = await exchange.cancelOrder('1', { from: user1 })
                })

                it('updates cancelled orders', async () => {
                    //makes sure the order is cancelled 
                    const orderCancelled = await exchange.orderCancelled(1)
                    //return true
                    orderCancelled.should.equal(true)
                })

                it('emits a "Cancel" event', async () => {
                    const log = result.logs[0]
                    log.event.should.eq('Cancel')
                    const event = log.args
                    event.id.toString().should.equal('1', 'id is correct')
                    event.user.should.equal(user1, 'user address is correct')
                    event.tokenGet.should.equal(token.address, 'tokenGet is correct')
                    event.amountGet.toString().should.equal(tokens(1).toString(), 'amountGet is correct')
                    event.tokenGive.should.equal('0x0000000000000000000000000000000000000000', 'tokenGive is correct')
                    event.amountGive.toString().should.equal(ether(1).toString(), 'amountGive is correct')
                    event.timestamp.toString().length.should.be.at.least(1, 'timestamp is present')
                })
            })

            describe('failure', async () => {
                it('rejects invalid order ids', async () => {
                    const invalidOrderId = 99999
                    await exchange.cancelOrder(invalidOrderId, { from: user1 }).should.be.rejectedWith(EVM_REVERT)
                })

                it('rejects unauthorized cancellations', async () => {
                    //Try to cancel the order from another user
                    await exchange.cancelOrder('1', { from: user2 }).should.be.rejectedWith(EVM_REVERT)
                })
            })
        })
    })

})
