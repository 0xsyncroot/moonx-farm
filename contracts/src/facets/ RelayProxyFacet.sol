// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {AggregatorProxy} from "../helpers/AggregatorProxy.sol";

contract  RelayProxyFacet is AggregatorProxy {
    constructor(address _relay) AggregatorProxy(_relay) {}

    function callRelay(uint256 fromTokenWithFee, uint256 fromAmt, uint256 toTokenWithFee, bytes calldata callData)
        external
        payable
    {
        _callAggregator(fromTokenWithFee, fromAmt, toTokenWithFee, callData);
    }
}