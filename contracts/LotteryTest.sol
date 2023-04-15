// SPDX-License-Identifier: MIT
// For testing purpose only
pragma solidity >=0.8.4 <=0.8.17;

contract LotteryTest {

    event UpdatedLottery(uint amount, uint nbPlayers, address lastPlayer);
    event WinnerPicked(uint week, address winner, uint amount, address picker);
    event ClaimedPrize(uint week, address winner, uint amount);

    struct WeekData {
        uint nbPlayers;
        uint amount;
        address winner;
        bool prizeClaimed;
        address picker;
    }

    mapping(uint => WeekData) public weekData;
    mapping(uint => mapping(uint => address)) public lottery;

    uint public genesisTimestamp;
    uint public royaltyAmount;
    uint public royaltyClaimable;
    address public owner;

    uint lotteryDuration = 7 days;
    uint claimingPeriod = 90 days;
    uint pickWinnerDelay = 10 minutes;

    uint winnerPct = 80;
    uint jackpotBonusPct = 10;
    uint pickerPct = 5;
    uint royaltyPct = 5;
    uint amountPerBet;
    bool private reentrencyLock;


    constructor(uint _genesisTimestamp, uint _amountPerBet) payable {
        require(winnerPct + jackpotBonusPct + pickerPct + royaltyPct == 100, "Inconsistent percentages, sum of percertages must be 100");
        require(claimingPeriod >= lotteryDuration, "The claimaing period should be at least as long as the lottery duration");
        genesisTimestamp = _genesisTimestamp - (7 days)*6 + 120;
        amountPerBet = _amountPerBet;
        owner = msg.sender;

        weekData[0].nbPlayers = 10;
        weekData[0].amount = 0.009 ether;
        lottery[0][0] = 0x39cBD3814757Be997040E51921e8D54618278A08;
        lottery[0][1] = 0xFc7eFb6Bfc363ec16D560A27A006832f32f65c20;
        lottery[0][2] = 0xE375204Da98055d1C96fc12172252fbaf105E052;
        lottery[0][3] = 0xb02DcDcaAc338fb5eE12Ca0A59457FA05d50c3e7;
        lottery[0][4] = 0x08EF4fa325B930a4C50B0E13e9bbD73F5611D3Fb;
        lottery[0][5] = 0xcbd7F9606C14C6f2d78a0C8ee3dBb3951A1635Fa;
        lottery[0][6] = 0xDDbdb60F31e5D5C0E1223C565F5344f66F8ae7F9;
        lottery[0][7] = 0xa24Bc4872264295f016c0765C1720853543C65d6;
        lottery[0][8] = 0x6DCd79066a3b629B9aaffb57d1D6654A3a8f49D5;
        lottery[0][9] = 0xD8eFE0bB9805B5862C0827B06B699cDF692dFf9B;

        weekData[1].nbPlayers = 9;
        weekData[1].amount = 0.0081 ether;
        lottery[1][0] = 0x39cBD3814757Be997040E51921e8D54618278A08;
        lottery[1][1] = 0xFc7eFb6Bfc363ec16D560A27A006832f32f65c20;
        lottery[1][2] = 0xE375204Da98055d1C96fc12172252fbaf105E052;
        lottery[1][3] = 0xb02DcDcaAc338fb5eE12Ca0A59457FA05d50c3e7;
        lottery[1][4] = 0x08EF4fa325B930a4C50B0E13e9bbD73F5611D3Fb;
        lottery[1][5] = 0xcbd7F9606C14C6f2d78a0C8ee3dBb3951A1635Fa;
        lottery[1][6] = 0xDDbdb60F31e5D5C0E1223C565F5344f66F8ae7F9;
        lottery[1][7] = 0xa24Bc4872264295f016c0765C1720853543C65d6;
        lottery[1][8] = 0x6DCd79066a3b629B9aaffb57d1D6654A3a8f49D5;

        weekData[2].nbPlayers = 8;
        weekData[2].amount = 0.0072 ether;
        lottery[2][0] = 0x39cBD3814757Be997040E51921e8D54618278A08;
        lottery[2][1] = 0xFc7eFb6Bfc363ec16D560A27A006832f32f65c20;
        lottery[2][2] = 0xE375204Da98055d1C96fc12172252fbaf105E052;
        lottery[2][3] = 0xb02DcDcaAc338fb5eE12Ca0A59457FA05d50c3e7;
        lottery[2][4] = 0x08EF4fa325B930a4C50B0E13e9bbD73F5611D3Fb;
        lottery[2][5] = 0xcbd7F9606C14C6f2d78a0C8ee3dBb3951A1635Fa;
        lottery[2][6] = 0xDDbdb60F31e5D5C0E1223C565F5344f66F8ae7F9;
        lottery[2][7] = 0xa24Bc4872264295f016c0765C1720853543C65d6;

        weekData[3].nbPlayers = 7;
        weekData[3].amount = 0.0063 ether;
        lottery[3][0] = 0x39cBD3814757Be997040E51921e8D54618278A08;
        lottery[3][1] = 0xFc7eFb6Bfc363ec16D560A27A006832f32f65c20;
        lottery[3][2] = 0xE375204Da98055d1C96fc12172252fbaf105E052;
        lottery[3][3] = 0xb02DcDcaAc338fb5eE12Ca0A59457FA05d50c3e7;
        lottery[3][4] = 0x08EF4fa325B930a4C50B0E13e9bbD73F5611D3Fb;
        lottery[3][5] = 0xcbd7F9606C14C6f2d78a0C8ee3dBb3951A1635Fa;
        lottery[3][6] = 0xDDbdb60F31e5D5C0E1223C565F5344f66F8ae7F9;

        weekData[4].nbPlayers = 6;
        weekData[4].amount = 0.0054 ether;
        lottery[4][0] = 0x39cBD3814757Be997040E51921e8D54618278A08;
        lottery[4][1] = 0xFc7eFb6Bfc363ec16D560A27A006832f32f65c20;
        lottery[4][2] = 0xE375204Da98055d1C96fc12172252fbaf105E052;
        lottery[4][3] = 0xb02DcDcaAc338fb5eE12Ca0A59457FA05d50c3e7;
        lottery[4][4] = 0x08EF4fa325B930a4C50B0E13e9bbD73F5611D3Fb;
        lottery[4][5] = 0xcbd7F9606C14C6f2d78a0C8ee3dBb3951A1635Fa;

        weekData[5].nbPlayers = 5;
        weekData[5].amount = 0.0045 ether;
        lottery[5][0] = 0x39cBD3814757Be997040E51921e8D54618278A08;
        lottery[5][1] = 0xFc7eFb6Bfc363ec16D560A27A006832f32f65c20;
        lottery[5][2] = 0xE375204Da98055d1C96fc12172252fbaf105E052;
        lottery[5][3] = 0xb02DcDcaAc338fb5eE12Ca0A59457FA05d50c3e7;
        lottery[5][4] = 0x08EF4fa325B930a4C50B0E13e9bbD73F5611D3Fb;

        royaltyAmount = 0.0045 ether;

    }


    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier onlyWinner(uint _week) {
        require(msg.sender == winnerIs(_week), "You are not the winner");
        require(block.timestamp < genesisTimestamp + (_week+1) * lotteryDuration + claimingPeriod, "Claiming period for this week is closed");
        require(weekData[_week].prizeClaimed == false, "You already claimed your prize");
        _;
    }

    modifier nonReentrant() {
        require(!reentrencyLock, "No reentrency");
        reentrencyLock = true;
        _;
        reentrencyLock = false;
    }

    function getWeek() public view returns(uint) {
        uint today = block.timestamp;
        require(today >= genesisTimestamp, "The Lottery hasn't started yet");
        return (today - genesisTimestamp) / lotteryDuration;
    }

    function getJackpotAmount() public view returns(uint) {
        uint week = getWeek();
        return weekData[week].amount;
    } 

    function bet() public payable {
        // The owner can't make any bet
        require(msg.sender != owner, "Owner can't bet");
        require(msg.value == amountPerBet, "The bet must be equal to [amountPerBet]");
        uint week = getWeek();
        
        weekData[week].amount += msg.value * winnerPct / 100;
        weekData[week+1].amount += msg.value * jackpotBonusPct / 100;
        royaltyAmount += msg.value * royaltyPct / 100;
        lottery[week][weekData[week].nbPlayers] = msg.sender;
        weekData[week].nbPlayers++;
        emit UpdatedLottery(weekData[week].amount, weekData[week].nbPlayers, msg.sender);
    }

    function pickWinner(uint _week) public nonReentrant {
        require(getWeek() > _week, "The lottery for this week is not closed yet");
        require(weekData[_week].winner == address(0), "Winner has already been picked for this week");
        require(weekData[_week].nbPlayers > 0, "There wasn't any participant to the lottery of this week");
        require(block.timestamp > genesisTimestamp + (_week+1) * lotteryDuration + pickWinnerDelay, "The waiting delay for picking the winner isn't finished yet");
        require(block.timestamp < genesisTimestamp + (_week+1) * lotteryDuration + claimingPeriod, "Claiming period for this week is closed");
        uint winnerIndex =  block.basefee % weekData[_week].nbPlayers;
        weekData[_week].winner = lottery[_week][winnerIndex];
        royaltyClaimable += royaltyAmount;
        royaltyAmount = 0;

        // Sending royalties to owner
        // Success is not required. Picker will get his reward even if sending royalties fails.
        bool royaltySent = payable(owner).send(royaltyClaimable);
        if (royaltySent) {
            royaltyClaimable = 0;
        }
        
        // Sending reward to the Picker
        // This is required. If it fails, royalties are not sent.
        uint pickerReward = (amountPerBet *  weekData[_week].nbPlayers * pickerPct) / 100;
        weekData[_week].picker = msg.sender;
        payable(msg.sender).transfer(pickerReward);
        emit WinnerPicked(_week, weekData[_week].winner, weekData[_week].amount, weekData[_week].picker);
    }

    function sendGift() public payable {
        require(msg.value >= 0.001 ether, "Gift must be greater than 0.001 eth");
        uint week = getWeek();
        weekData[week].amount += msg.value;
        emit UpdatedLottery(weekData[week].amount, weekData[week].nbPlayers, msg.sender);
    }
    
    function winnerIs(uint _week) public view returns(address) {
        require(getWeek() > _week, "Lottery of this week is not closed yet, please try later");
        require(weekData[_week].nbPlayers > 0, "There wasn't any participant during this week");
        require(weekData[_week].winner != address(0), "The winner for this week has not been picked yet, please call pickWinner()");
        return weekData[_week].winner;
    }

    function claimPrize(uint _week) public onlyWinner(_week) nonReentrant {
        weekData[_week].prizeClaimed = true;
        payable(msg.sender).transfer(weekData[_week].amount);
        emit ClaimedPrize(_week, weekData[_week].winner, weekData[_week].amount);
    }

    function claimUnclaimedPrize(uint _week) public onlyOwner nonReentrant {
        require(weekData[_week].prizeClaimed == false, "The prize has been already claimed");
        // The owner can claim an unclaimed prize if the claiming period is finished
        // or if there was 0 participant to the lottery and the lottery is closed
        if (weekData[_week].nbPlayers > 0) {
            require(block.timestamp > genesisTimestamp + (_week+1) * lotteryDuration + claimingPeriod,
            "The claiming period isn't finished");
            if (weekData[_week].winner != address(0)) {
                weekData[_week].prizeClaimed = true;
                payable(owner).transfer(weekData[_week].amount);
            } else {
                uint pickerReward = (weekData[_week].nbPlayers * amountPerBet * pickerPct) / 100;
                weekData[_week].prizeClaimed = true;
                payable(owner).transfer(weekData[_week].amount + pickerReward);
            }
        } else {
            require(block.timestamp > genesisTimestamp + (_week+1) * lotteryDuration,
            "The lottery must be closed before claiming an unclaimed prize");
            weekData[_week].prizeClaimed = true;
            payable(owner).transfer(weekData[_week].amount);          
        }
    }

    function claimRoyalty() public onlyOwner nonReentrant {
        require(royaltyClaimable > 0, "There is no royalty");
        uint royaltyToWithdraw = royaltyClaimable;
        royaltyClaimable = 0; 
        payable(owner).transfer(royaltyToWithdraw);
    }

    function setOwner(address _newOwner) public onlyOwner {
        owner = _newOwner;
    }

    receive() external payable{
        sendGift();
    }

}


