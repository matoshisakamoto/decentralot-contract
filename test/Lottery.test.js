const Lottery = artifacts.require("Lottery");
const WinnerAttack = artifacts.require("PrizeWinnerAttack");
const OwnerBlock =  artifacts.require("OwnerBlock");
const OwnerAttack = artifacts.require("OwnerAttack");
const OwnerAttack2 = artifacts.require("OwnerAttack2");

const truffleAssert = require('truffle-assertions');
const day = getSeconds("01:00:00:00");
const week = getSeconds("07:00:00:00");
const pickerPct = 5;

function truncate(BINumber) {
    return BINumber / BigInt(1e5);
}
function getSeconds(time) {
    const temps = [1, 60, 3600, 3600*24];
    const timeArray = time.split(':');
    let total = 0;
    let j = 0;
    
    for (let i = timeArray.length-1; i >= 0; i--) {
      total += parseInt(timeArray[i]) * temps[j];
      j++;
    }
  
    return total;
}

const advanceBlockAtTime = (time) => {
    return new Promise((resolve, reject) => {
      web3.currentProvider.send(
        {
          jsonrpc: "2.0",
          method: "evm_mine",
          params: [time],
          id: new Date().getTime(),
        },
        (err, _) => {
          if (err) {
            return reject(err);
          }
          const newBlockHash = web3.eth.getBlock("latest").hash;
  
          return resolve(newBlockHash);
        },
      );
    });
  };


contract("Lottery", (accounts) => {

    let lotteryInstance;
    let genesisTimestamp;
    let accountMap = {};

    before(async () => {
        lotteryInstance = await Lottery.deployed();
        genesisTimestamp = await lotteryInstance.genesisTimestamp();
        await advanceBlockAtTime(genesisTimestamp.toNumber());

        for (let i=0; i < accounts.length; i++) {
            accountMap[accounts[i]] = i;
        }
    });

    describe("Week 0", async () => {

        let winnerShould;
        
        it('Contract Balance should be equal to 6 eth', async () => {
            await lotteryInstance.bet({from:accounts[1], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[2], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[3], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[4], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[5], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[6], value: web3.utils.toWei("1", "ether")});

            let contractBalance = await web3.eth.getBalance(lotteryInstance.address);
            assert.equal(contractBalance, web3.utils.toWei("6", "ether"));
        });

        it('Calling winnerIs before the end of the week should fail', async () => {
            await truffleAssert.fails(
                lotteryInstance.winnerIs(0, {from:accounts[1]}),
                truffleAssert.ErrorType.REVERT,
                "Lottery of this week is not closed yet, please try later"
            );
        });

        it('Claiming the prize before the week ended should fail', async () => {
            await truffleAssert.fails(
                lotteryInstance.claimPrize(0, {from:accounts[1]}),
                truffleAssert.ErrorType.REVERT,
                "Lottery of this week is not closed yet, please try later"
            );
        });

        it('Claiming royalties from non owner should fail', async () => {
            await truffleAssert.fails(
                lotteryInstance.claimRoyalty({from:accounts[1]}),
                truffleAssert.ErrorType.REVERT,
                "Only owner can perform this action"
            );
        });

        it('Claiming royalties before the winner has been picked should fail', async () => {
            await truffleAssert.fails(
                lotteryInstance.claimRoyalty({from:accounts[0]}),
                truffleAssert.ErrorType.REVERT,
                "There is no royalty"
            );
        });

        it('Picking the winner before the end of the waiting delay should fail', async () => {
            await advanceBlockAtTime(genesisTimestamp.toNumber() + getSeconds('7:00:05:00'));
            await truffleAssert.fails(
                lotteryInstance.pickWinner(0, {from:accounts[2]}),
                truffleAssert.ErrorType.REVERT,
                "The waiting delay for picking the winner isn't finished yet"
            );
        });

        it('Picking the winner after the waiting delay should succed & picker should get his reward', async () => {
            await advanceBlockAtTime(genesisTimestamp.toNumber() + getSeconds('7:00:10:01'));
            let picker = accounts[1];
            let pickerBalanceBefore = BigInt(await web3.eth.getBalance(picker));
            let tx = await lotteryInstance.pickWinner(0, {from:picker});
            let pickerBalanceAfter =  BigInt(await web3.eth.getBalance(picker));

            let weekData = await lotteryInstance.weekData(0);
            let winner = weekData['winner'];
            let nbPlayers = BigInt(weekData['nbPlayers']);

            let lastBlockBetter = await web3.eth.getBlock(tx['receipt']['blockNumber']);
            let lastWeekBaseFee = lastBlockBetter['baseFeePerGas'];
            let winnerIndexShould = lastWeekBaseFee % weekData['nbPlayers'];
            winnerShould = await lotteryInstance.lottery(0, winnerIndexShould);

            let pickerReward = (nbPlayers * BigInt(web3.utils.toWei("1") * pickerPct))/BigInt(100);
            let txFee = BigInt(tx['receipt']['gasUsed']) * BigInt(tx['receipt']['effectiveGasPrice']);
            let pickerBalanceAfterShould = pickerBalanceBefore + pickerReward - txFee;

            assert.equal(winner, winnerShould, "Wrong winner");
            assert.equal(pickerBalanceAfter, pickerBalanceAfterShould, "Wrong Picker Balance");
        });

        it("Better who didn't win try to claim the prize", async () => {
            let nonWinnerIndex = accountMap[winnerShould] + 1 % accounts.length;
            let nonWinner = accounts[nonWinnerIndex];

            await truffleAssert.fails(
                lotteryInstance.claimPrize(0, {from:nonWinner}),
                truffleAssert.ErrorType.REVERT,
                "You are not the winner"
            );
        });

        it("Owner tries to claim the prize of the winner", async () => {
            await truffleAssert.fails(
                lotteryInstance.claimPrize(0, {from:accounts[0]}),
                truffleAssert.ErrorType.REVERT,
                "You are not the winner"
            );
        });

        it("Owner tries to claim the price of the winner as an unclaimed prize", async () => {
            await truffleAssert.fails(
                lotteryInstance.claimUnclaimedPrize(0, {from:accounts[0]}),
                truffleAssert.ErrorType.REVERT,
                "The claiming period isn't finished"
            );
        });

        it('Winner should get his prize', async () => {
            let winnerBalanceBefore = BigInt(await web3.eth.getBalance(winnerShould));
            let contractBalanceBefore = BigInt(await web3.eth.getBalance(lotteryInstance.address));

            let weekData = await lotteryInstance.weekData(0);
            let winnerAmount = BigInt(weekData['amount']);

            let tx = await lotteryInstance.claimPrize(0, {from:winnerShould});
            let winnerGasFee = BigInt(tx['receipt']['gasUsed']) * BigInt(tx['receipt']['effectiveGasPrice']);

            let winnerBalanceAfter = BigInt(await web3.eth.getBalance(winnerShould));
            let contractBalanceAfter = BigInt(await web3.eth.getBalance(lotteryInstance.address));

            let winnerBalanceShould = winnerBalanceBefore + winnerAmount - winnerGasFee;
            let contractBalanceShould = contractBalanceBefore - winnerAmount;

            assert.equal(truncate(winnerBalanceAfter), truncate(winnerBalanceShould), "Wrong winner balance");
            assert.equal(truncate(contractBalanceAfter), truncate(contractBalanceShould), "Wrong contract balance");
        });

        it('Winner claims his prize twice', async () => {

            await truffleAssert.fails(
                lotteryInstance.claimPrize(0, {from:winnerShould}),
                truffleAssert.ErrorType.REVERT,
                "You already claimed your prize"
            );

        });

        it("Owner tries to claim the prize of the winner", async () => {
            await truffleAssert.fails(
                lotteryInstance.claimPrize(0, {from:accounts[0]}),
                truffleAssert.ErrorType.REVERT,
                "You are not the winner"
            );
        });

        it("Owner tries to claim the prize of the winner as an unclaimed prize", async () => {
            await truffleAssert.fails(
                lotteryInstance.claimUnclaimedPrize(0, {from:accounts[0]}),
                truffleAssert.ErrorType.REVERT,
                "The prize has been already claimed"
            );
        });

        it("Owner tries to claim the prize of the winner as an unclaimed prize after the claiming delay", async () => {
            await advanceBlockAtTime(genesisTimestamp.toNumber() + getSeconds('100:00:00:00'));
            let lastBlock = await web3.eth.getBlock('latest');
            let timestamp = lastBlock['timestamp'];
            console.log('timestamp', timestamp);
            await truffleAssert.fails(
                lotteryInstance.claimUnclaimedPrize(0, {from:accounts[0]}),
                truffleAssert.ErrorType.REVERT,
                "The prize has been already claimed"
            );
        });

    });
});



contract("Owner tries to claim unclaimed prize ", (accounts) => {

    let lotteryInstance;
    let genesisTimestamp;
    let accountMap = {};

    before(async () => {
        lotteryInstance = await Lottery.deployed();
        genesisTimestamp = await lotteryInstance.genesisTimestamp();
        await advanceBlockAtTime(genesisTimestamp.toNumber());

        for (let i=0; i < accounts.length; i++) {
            accountMap[accounts[i]] = i;
        }
    });

    describe("Week 0", async () => {

        let winnerShould;
        
        it('Contract Balance should be equal to 10 eth', async () => {
            await lotteryInstance.bet({from:accounts[1], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[2], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[3], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[4], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[5], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[1], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[2], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[3], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[4], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[5], value: web3.utils.toWei("1", "ether")});
            let contractBalance = await web3.eth.getBalance(lotteryInstance.address);
            assert.equal(contractBalance, web3.utils.toWei("10", "ether"));       
         });


         it('Owner tries to claim week 1 prize before the first bet', async () => {
            await advanceBlockAtTime(genesisTimestamp.toNumber() + getSeconds('7:00:00:01'));
            await truffleAssert.fails(
                lotteryInstance.claimUnclaimedPrize(1, {from:accounts[0]}),
                truffleAssert.ErrorType.REVERT,
                "The lottery must be closed before claiming an unclaimed prize"
            );
         });

        it("Owner can claim a prize if there weren't any particpant on week 1", async () => {
            await advanceBlockAtTime(genesisTimestamp.toNumber() + getSeconds('14:00:00:01'));
            let weekData = await lotteryInstance.weekData(1);
            let prizeAmount = BigInt(weekData['amount']);

            let ownerBalanceBefore =  BigInt(await web3.eth.getBalance(accounts[0]));
            let tx = await lotteryInstance.claimUnclaimedPrize(1, {from:accounts[0]});
            let gasFee = BigInt(tx['receipt']['gasUsed']) * BigInt(tx['receipt']['effectiveGasPrice']);
            
            let ownerBalanceAfter =  BigInt(await web3.eth.getBalance(accounts[0]));
            let ownerBalanceShould = ownerBalanceBefore + prizeAmount - gasFee;

            assert.equal(truncate(ownerBalanceAfter), truncate(ownerBalanceShould), "Wrong owner balance");
        });

    });


    describe("Week 3 : The winner don't claim his prize", async () => {

        it("The lottery amount should be 0.8 ether", async () => {
            await advanceBlockAtTime(genesisTimestamp.toNumber() + getSeconds('21:00:00:01'));
            await lotteryInstance.bet({from:accounts[1], value: web3.utils.toWei("1", "ether")});
            let weekData = await lotteryInstance.weekData(3);
            assert.equal(weekData['amount'],  web3.utils.toWei("0.8", "ether"));
        });

        it("Owner tries to claim the unclaimed prize before the lottery is closed", async () => {
            await truffleAssert.fails(
                lotteryInstance.claimUnclaimedPrize(3, {from:accounts[0]}),
                truffleAssert.ErrorType.REVERT,
                "The claiming period isn't finished"
            );
        });

        it("Owner tries to claim the unclaimed prize when the lottery is closed", async () => {
            await advanceBlockAtTime(genesisTimestamp.toNumber() + getSeconds('28:00:10:01'));
            await lotteryInstance.pickWinner(3, {from:accounts[2]})
            await truffleAssert.fails(
                lotteryInstance.claimUnclaimedPrize(3, {from:accounts[0]}),
                truffleAssert.ErrorType.REVERT,
                "The claiming period isn't finished"
            );
        });

        it("Owner can claim an unclaimed prize when the claiming period is finished", async () => {
            await advanceBlockAtTime(genesisTimestamp.toNumber() + getSeconds('118:00:00:01'));

            let weekData = await lotteryInstance.weekData(3);
            let prizeAmount = BigInt(weekData['amount']);

            let ownerBalanceBefore =  BigInt(await web3.eth.getBalance(accounts[0]));
            let tx = await lotteryInstance.claimUnclaimedPrize(3, {from:accounts[0]});
            let gasFee = BigInt(tx['receipt']['gasUsed']) * BigInt(tx['receipt']['effectiveGasPrice']);
            
            let ownerBalanceAfter =  BigInt(await web3.eth.getBalance(accounts[0]));
            let ownerBalanceShould = ownerBalanceBefore + prizeAmount - gasFee;

            assert.equal(truncate(ownerBalanceAfter), truncate(ownerBalanceShould), "Wrong owner balance");
        });

    });
});



contract("Owner tries to claim unclaimed prize if there is 0 participant", (accounts) => {

    let lotteryInstance;
    let genesisTimestamp;
    let accountMap = {};

    before(async () => {
        lotteryInstance = await Lottery.deployed();
        genesisTimestamp = await lotteryInstance.genesisTimestamp();
        await advanceBlockAtTime(genesisTimestamp.toNumber());

        for (let i=0; i < accounts.length; i++) {
            accountMap[accounts[i]] = i;
        }
    });

    describe("Week 0", async () => {

        let winnerShould;
        
        it('Contract Balance should be equal to 10 eth', async () => {
            await lotteryInstance.bet({from:accounts[1], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[2], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[3], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[4], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[5], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[1], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[2], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[3], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[4], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[5], value: web3.utils.toWei("1", "ether")});
            let contractBalance = await web3.eth.getBalance(lotteryInstance.address);
            console.log('type of balance', typeof contractBalance)
            assert.equal(contractBalance, web3.utils.toWei("10", "ether"));       
        });

    });

    describe("Week 1 : 0 participant", async () => {

        it('Amount of prize should be 1 ether', async () => {
            let weekData = await lotteryInstance.weekData(1);
            assert.equal(BigInt(weekData['amount']), BigInt(web3.utils.toWei("1", "ether")));
        });
    });

    describe("Owner tries to claim the prize before the lottery is closed", async () => {

        it('Claiming the prize before the lottery is closed should fail', async () => {
            await truffleAssert.fails(
                lotteryInstance.claimUnclaimedPrize(1, {from:accounts[0]}),
                truffleAssert.ErrorType.REVERT,
                "The lottery must be closed before claiming an unclaimed prize"
            );
        });

        it('Claiming the prize 1 minute before the lottery is closed should fail', async () => {
            await advanceBlockAtTime(genesisTimestamp.toNumber() + week + getSeconds('6:23:59:00'));
            await truffleAssert.fails(
                lotteryInstance.claimUnclaimedPrize(1, {from:accounts[0]}),
                truffleAssert.ErrorType.REVERT,
                "The lottery must be closed before claiming an unclaimed prize"
            );
        });

        it('Claiming the prize 1 second after the lottery is closed should succeed', async () => {
            await advanceBlockAtTime(genesisTimestamp.toNumber() + week*1 + getSeconds('7:00:00:01'));
            let weekData = await lotteryInstance.weekData(1);
            let prizeAmount = BigInt(weekData['amount']);
            let ownerBalanceBefore = BigInt(await web3.eth.getBalance(accounts[0]));

            tx = await lotteryInstance.claimUnclaimedPrize(1, {from:accounts[0]});
            let txFee = BigInt(tx['receipt']['gasUsed']) * BigInt(tx['receipt']['effectiveGasPrice']);
            let ownerBalanceAfter =  BigInt(await web3.eth.getBalance(accounts[0]));
            let ownerBalanceShould = ownerBalanceBefore + prizeAmount - txFee;
            
            assert.equal(truncate(ownerBalanceAfter), truncate(ownerBalanceShould));
        });

    });

});



contract("Prize Winner try to drain the contract funds", (accounts) => {

    let lotteryInstance;
    let genesisTimestamp;
    let accountMap = {};
    let owner;
    let attacker;
    let attackerInstance;

    before(async () => {
        lotteryInstance = await Lottery.deployed();
        genesisTimestamp = await lotteryInstance.genesisTimestamp();
        await advanceBlockAtTime(genesisTimestamp.toNumber());

        for (let i=0; i < accounts.length; i++) {
            accountMap[accounts[i]] = i;
        }
        owner = accounts[0];
        attacker = accounts[2];
        attackerInstance = await WinnerAttack.new(lotteryInstance.address, {from:attacker});
    });

    describe("Week 0", async () => {

        it('Contract Balance should be equal to 10 eth', async () => {
            await attackerInstance.bet({from:attacker, value: web3.utils.toWei("1", "ether")});
            await attackerInstance.bet({from:attacker, value: web3.utils.toWei("1", "ether")});
            await attackerInstance.bet({from:attacker, value: web3.utils.toWei("1", "ether")});
            await attackerInstance.bet({from:attacker, value: web3.utils.toWei("1", "ether")});
            await attackerInstance.bet({from:attacker, value: web3.utils.toWei("1", "ether")});
            await attackerInstance.bet({from:attacker, value: web3.utils.toWei("1", "ether")});
            await attackerInstance.bet({from:attacker, value: web3.utils.toWei("1", "ether")});
            await attackerInstance.bet({from:attacker, value: web3.utils.toWei("1", "ether")});
            await attackerInstance.bet({from:attacker, value: web3.utils.toWei("1", "ether")});
            await attackerInstance.bet({from:attacker, value: web3.utils.toWei("1", "ether")});
            let contractBalance = await web3.eth.getBalance(lotteryInstance.address);
            assert.equal(contractBalance, web3.utils.toWei("10", "ether"));       
        });

    });

    describe("Week 1", async () => {

        it('Winner should be the attack contract', async () => {
            await advanceBlockAtTime(genesisTimestamp.toNumber() + getSeconds('7:00:10:01'));
            await lotteryInstance.pickWinner(0, {from:attacker});
            let winner = await lotteryInstance.winnerIs(0);
            assert.equal(winner, attackerInstance.address, "Wrong winner");
        });

        it("Attacker prize should be 8 eth", async () => {
            let weekData = await lotteryInstance.weekData(0);
            let attackerPrice = BigInt(weekData['amount']);
            assert.equal(attackerPrice, BigInt(web3.utils.toWei("8", "ether")), "Wrong prize amount");
        });

        it('Owner sent a 70 eth gift - Balance should be 80 eth', async () => {
            await lotteryInstance.sendGift({from:owner, value:web3.utils.toWei("71", "ether")});
            let contractBalance = await web3.eth.getBalance(lotteryInstance.address);
            assert.equal(contractBalance, web3.utils.toWei("80", "ether"), "Wrong contract balance");
        });

        it('Winner attack should fail', async () => {

            let contractBalanceBefore = await web3.eth.getBalance(lotteryInstance.address);
            let attackerBalanceBefore = await web3.eth.getBalance(attacker);
            
            await truffleAssert.fails(
                attackerInstance.attack({from:attacker,gas: 3000000}),
                truffleAssert.ErrorType.REVERT
            );            
            let contractBalanceAfter = await web3.eth.getBalance(lotteryInstance.address);
            let attackerBalanceAfter = await web3.eth.getBalance(attacker);

            assert.equal(contractBalanceAfter, contractBalanceBefore, "Wrong contract balance");
            assert(attackerBalanceAfter < attackerBalanceBefore, "Wrong attacker balance");
        });

        it("Now the attacker is screwed, he will never be able to claim his prize because he implemented " +
        "a reentrancy attack in his receive function. Each time he calls claimPrize(), he receives his prize " +
        "but call claimPrize again and the whole transaction is reverted because of lack of gas", async () => {
        });

    });

});



contract("Owner tries to drain the funds with claimRoyalty()", (accounts) => {
    
    let lotteryInstance;
    let genesisTimestamp;
    let accountMap = {};
    let owner;
    let attackerInstance;

    before(async () => {
        lotteryInstance = await Lottery.deployed();
        genesisTimestamp = await lotteryInstance.genesisTimestamp();
        await advanceBlockAtTime(genesisTimestamp.toNumber());

        for (let i=0; i < accounts.length; i++) {
            accountMap[accounts[i]] = i;
        }
        owner = accounts[0];
        blockerInstance =  await OwnerBlock.new(lotteryInstance.address, {from:owner});
        attackerInstance = await OwnerAttack.new(lotteryInstance.address, {from:owner});
    });

    describe("Week 0", async () => {

        it('Contract Balance should be equal to 10 eth', async () => {
            await lotteryInstance.bet({from:accounts[1], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[2], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[3], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[4], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[5], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[1], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[2], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[3], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[4], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[5], value: web3.utils.toWei("1", "ether")});
            let contractBalance = await web3.eth.getBalance(lotteryInstance.address);
            assert.equal(contractBalance, web3.utils.toWei("10", "ether"));       
        });

    });

    describe("Week 1", async () => {

        it("New owner should be the blocker contract", async () => {
            await lotteryInstance.setOwner(blockerInstance.address, {from:owner});
            let lotteryOwner = await lotteryInstance.owner();
            assert.equal(lotteryOwner, blockerInstance.address, "Wrong contract owner");
        });

        it("A player pick the winner, he should get his reward, but the owner should block the royalty transfer", async () => {
            await advanceBlockAtTime(genesisTimestamp.toNumber() + getSeconds('7:00:10:01'));
            let picker = accounts[1];
            let lotteryOwner = await lotteryInstance.owner();
            let pickerBalanceBefore = BigInt(await web3.eth.getBalance(picker));
            let ownerBalanceBefore = BigInt(await web3.eth.getBalance(lotteryOwner));

            tx = await lotteryInstance.pickWinner(0,  {from:picker});

            let pickerBalanceAfter = await web3.eth.getBalance(picker);
            let ownerBalanceAfter = BigInt(await web3.eth.getBalance(lotteryOwner));
            let gasFee = BigInt(tx['receipt']['gasUsed']) * BigInt(tx['receipt']['effectiveGasPrice']);
            let pickerReward = BigInt(web3.utils.toWei("0.5", "ether"));
            
            let pickerBalanceAfterShould = pickerBalanceBefore + pickerReward - gasFee;
            
            assert.equal(pickerBalanceAfter, pickerBalanceAfterShould, "Wrong picker Balance");
            assert.equal(ownerBalanceAfter, ownerBalanceBefore, "Wrong owner Balance");
            
        });
        
        it('Contract Balance should be 9.5 ether', async () => {
            let contractBalance = BigInt(await web3.eth.getBalance(lotteryInstance.address));
            assert.equal(contractBalance, BigInt(web3.utils.toWei("9.5", "ether")), "Wrong contract Balance");
        });

        it('Claimable royalty should be 0.5 ether', async () => {
            let claimableRoyalty = BigInt(await lotteryInstance.royaltyClaimable());
            assert.equal(claimableRoyalty, BigInt(web3.utils.toWei("0.5", "ether")), "Wrong claimable amount");
        });

        it("New owner should be the attacker contract", async () => {
            await blockerInstance.setOwner(attackerInstance.address, {from:owner});
            let lotteryOwner = await lotteryInstance.owner();
            assert.equal(lotteryOwner, attackerInstance.address, "Wrong contract owner");
        });

        it("Owner attack should fail", async () => {
            let contractBalanceBefore = await web3.eth.getBalance(lotteryInstance.address);
            let ownerBalanceBefore = await web3.eth.getBalance(owner);

            await truffleAssert.fails(
                attackerInstance.attack({from:owner,gas: 3000000}),
                truffleAssert.ErrorType.REVERT,
                "No reentrency"
            );

            let contractBalanceAfter = await web3.eth.getBalance(lotteryInstance.address);
            let ownerBalanceAfter = await web3.eth.getBalance(owner);

            assert.equal(contractBalanceAfter, contractBalanceBefore, "Wrong contract balance");
            assert(ownerBalanceAfter < ownerBalanceBefore, "Wrong attacker balance");
        });

        it("Owner could'nt get his royalty. But he can still transfer the lottery ownership to an External Owned Account " +
        "and call again claimRoyalty() without trying to perform a reentrancy attack", async () => {
        });

    });

});



contract("Owner tries to drain the contract funds with claimUnclaimedPrize()", (accounts) => {
    
    let lotteryInstance;
    let genesisTimestamp;
    let accountMap = {};
    let owner;
    let attackerInstance;

    before(async () => {
        lotteryInstance = await Lottery.deployed();
        genesisTimestamp = await lotteryInstance.genesisTimestamp();
        await advanceBlockAtTime(genesisTimestamp.toNumber());

        for (let i=0; i < accounts.length; i++) {
            accountMap[accounts[i]] = i;
        }
        owner = accounts[0];
        attackerInstance = await OwnerAttack2.new(lotteryInstance.address, {from:owner});
    });

    describe("Week 0", async () => {

        it('Contract Balance should be equal to 10 eth', async () => {
            await lotteryInstance.bet({from:accounts[1], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[2], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[3], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[4], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[5], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[1], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[2], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[3], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[4], value: web3.utils.toWei("1", "ether")});
            await lotteryInstance.bet({from:accounts[5], value: web3.utils.toWei("1", "ether")});
            let contractBalance = await web3.eth.getBalance(lotteryInstance.address);
            assert.equal(contractBalance, web3.utils.toWei("10", "ether"));
        });

    });

    describe("Week 1", async () => {

        it('Winner from week 0 should be picked', async () => {
            await advanceBlockAtTime(genesisTimestamp.toNumber() + getSeconds('7:00:10:01'));
            await lotteryInstance.pickWinner(0, {from:owner});
            let zeroAddress = "0x0000000000000000000000000000000000000000";
            let winner0 = await lotteryInstance.winnerIs(0);
            assert(winner0 != zeroAddress, "The winner0 should be picked");
        });

        it("New owner should be the attacker contract", async () => {
            await lotteryInstance.setOwner(attackerInstance.address, {from:owner});
            let lotteryOwner = await lotteryInstance.owner();
            assert.equal(lotteryOwner, attackerInstance.address, "Wrong contract owner");
        });
    });

    describe("90 days later", async () => {

        it("Owner attack should fail", async () => {
            await advanceBlockAtTime(genesisTimestamp.toNumber() + getSeconds('97:00:00:01'));
            let contractBalanceBefore = await web3.eth.getBalance(lotteryInstance.address);
            let ownerBalanceBefore = await web3.eth.getBalance(owner);

            await truffleAssert.fails(
                attackerInstance.attack({from:owner,gas: 3000000}),
                truffleAssert.ErrorType.REVERT
            );

            let contractBalanceAfter = await web3.eth.getBalance(lotteryInstance.address);
            let ownerBalanceAfter = await web3.eth.getBalance(owner);

            assert.equal(contractBalanceAfter, contractBalanceBefore, "Wrong contract balance");
            assert(ownerBalanceAfter < ownerBalanceBefore, "Wrong attacker balance");
        });

        it("Owner could'nt get the unclaimed Prize. But he can still transfer the lottery ownership to an External Owned Account " +
        "and call again claimUnclaimedPrize() without trying to perform a reentrancy attack", async () => {
        });

    });

});



contract("Decreasing bets from 100 to 1", (accounts) => {
    
    let lotteryInstance;
    let genesisTimestamp;
    let accountMap = {};
    let owner;

    before(async () => {
        lotteryInstance = await Lottery.deployed();
        genesisTimestamp = await lotteryInstance.genesisTimestamp();
        await advanceBlockAtTime(genesisTimestamp.toNumber());

        for (let i=0; i < accounts.length; i++) {
            accountMap[accounts[i]] = i;
        }
        owner = accounts[0];
    });
    
    describe("Week 0", async () => {

        it('100 bets - Contract balance should be 100 eth', async () => {
            const promises = [];
            for (let i=0; i<100; i++){
                promises.push(lotteryInstance.bet({from:accounts[i%9+1], value: web3.utils.toWei("1", "ether")}));
            }

            await Promise.all(promises);
            let contractBalance = await web3.eth.getBalance(lotteryInstance.address);
            console.log("contractBalance", contractBalance);
            assert.equal(contractBalance, web3.utils.toWei("100", "ether"));
        });

        it('Pick winner + Prize claiming - Contract balance should be 10 eth', async () => {
            await advanceBlockAtTime(genesisTimestamp.toNumber() + getSeconds('7:00:10:01'));
            await lotteryInstance.pickWinner(0);
            let winner = await lotteryInstance.winnerIs(0);

            await lotteryInstance.claimPrize(0, {from:winner});
            let contractBalance = await web3.eth.getBalance(lotteryInstance.address);

            assert.equal(contractBalance, web3.utils.toWei("10"), "Wrong contract balance")
        });

    });


    describe("Week 1", async () => {

        it('10 bets - Balance should be 20 eth', async () => {
            const promises = [];
            for (let i=0; i<10; i++){
                promises.push(lotteryInstance.bet({from:accounts[i%9+1], value: web3.utils.toWei("1", "ether")}));
            }

            await Promise.all(promises);
            let contractBalance = await web3.eth.getBalance(lotteryInstance.address);
            assert.equal(contractBalance, web3.utils.toWei("20", "ether"));
        });
        
        it('Pick winner + Prize claiming - Contract balance should be 1 eth', async () => {
            await advanceBlockAtTime(genesisTimestamp.toNumber() + getSeconds('14:00:10:01'));
            await lotteryInstance.pickWinner(1);
            let winner = await lotteryInstance.winnerIs(1);

            await lotteryInstance.claimPrize(1, {from:winner});
            let contractBalance = await web3.eth.getBalance(lotteryInstance.address);

            assert.equal(contractBalance, web3.utils.toWei("1"), "Wrong contract balance")
        });
        
    });


    describe("Week 2", async () => {

        it('1 bets - Balance should be 2 eth', async () => {
            const promises = [];
            for (let i=0; i<1; i++){
                promises.push(lotteryInstance.bet({from:accounts[i%9+1], value: web3.utils.toWei("1", "ether")}));
            }

            await Promise.all(promises);
            let contractBalance = await web3.eth.getBalance(lotteryInstance.address);
            assert.equal(contractBalance, web3.utils.toWei("2", "ether"));
        });

        it('Pick winner + Prize claiming - Contract balance should be 0.1 eth', async () => {
            await advanceBlockAtTime(genesisTimestamp.toNumber() + getSeconds('21:00:10:01'));
            await lotteryInstance.pickWinner(2);
            let winner = await lotteryInstance.winnerIs(2);

            await lotteryInstance.claimPrize(2, {from:winner});
            let contractBalance = await web3.eth.getBalance(lotteryInstance.address);

            assert.equal(contractBalance, web3.utils.toWei("0.1"), "Wrong contract balance")
        });
        
    });

});


