const Token = artifacts.require("Token")
const Exchange = artifacts.require("Exchange")


module.exports = async function(callback) {
    //TODO: Fill me in....
    try {
        //Fetch accounts from wallet - Those are unlocked 
        const accounts = await web3.eth.getAccounts()

        // fetch the deployed Token
        const token = await Token.deployed()
        console.log('Token fetched', token.address)

        //Fetch the deployed Exchange
        const exchange = await Exchange.deployed()
        console.log('Exchange fetched', exchange.address)

        //Give tokens to account[1]
        const sender = accounts[0]
        const receiver = accounts[1]
        let amount = web3.utils.toWei('1000', 'ether')

        await token.transfer(receiver, amount, { from: sender })
        console.log(`Transferred ${amount} tokens from ${sender} to ${receiver}`)

        console.log("script running...")
    }
    catch(err) {
        console.log(error)
    } 
    callback()
}