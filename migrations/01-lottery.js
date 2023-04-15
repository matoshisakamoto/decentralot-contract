const testnetLaunchDate = new Date('2023-04-17T00:00+00:00');
const testnetTimestamp = parseInt(testnetLaunchDate.getTime()/1000)

const mainnetLaunchDate = new Date('2023-05-01T00:00+00:00');
const mainnetTimestamp = parseInt(mainnetLaunchDate.getTime()/1000)

const Lottery = artifacts.require("Lottery");

module.exports = async function(deployer) {
    const networkId = await web3.eth.net.getId();
    console.log("networkId", networkId)

    if (networkId === 1337) {
        await deployer.deploy(Lottery, mainnetTimestamp, web3.utils.toWei("1", "ether"));

    } else if (networkId === 137) { // Polygon Mainnet
        await deployer.deploy(Lottery, mainnetTimestamp, web3.utils.toWei("1", "ether"));

    } else if (networkId === 80001) { // Polygon Testnet Mumbai
        await deployer.deploy(Lottery, testnetTimestamp, web3.utils.toWei("1", "ether"));

    } else if (networkId === 5) { // Goerli Testnet
        await deployer.deploy(Lottery, testnetTimestamp, web3.utils.toWei("0.001", "ether"));

    } else if (networkId === 11155111) { // Sepolia Testnet
        await deployer.deploy(Lottery, testnetTimestamp, web3.utils.toWei("0.001", "ether"));

    } else {
      console.log("wrong network")
    }
}
