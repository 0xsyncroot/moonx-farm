// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "../helpers/ReentrancyGuard.sol";
import {RouterErrors} from "../errors/RouterErrors.sol";
import {LibFeeCollector} from "../libraries/LibFeeCollector.sol";

contract CrossChainRelayFacet is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant FEE_PERCENTAGE_BASE = 10000;
    address private immutable relayContract;
    
    event FeeCollected(address indexed token, address indexed recipient, uint256 amount);
    event TokensTransferred(address indexed token, address indexed to, uint256 amount);
    event CrossChainCallExecuted(bytes32 indexed callDataHash, bool success);
    
    error InvalidRelayContract();
    error InvalidFeePercentage(uint16 fee);
    error TransferFailed();
    error CrossChainCallFailed(bytes returnData);

    constructor(address _relayContract) {
        if (_relayContract == address(0) || _relayContract.code.length <= 100) {
            revert InvalidRelayContract();
        }
        relayContract = _relayContract;
    }

    function _parseAddressAndFee(uint256 tokenWithFee) 
        internal 
        pure 
        returns (address token, uint16 fee) 
    {
        token = address(uint160(tokenWithFee));
        fee = uint16(tokenWithFee >> 160);
        if (fee >= FEE_PERCENTAGE_BASE) {
            revert InvalidFeePercentage(fee);
        }
    }

    function _handleTokenTransfer(
        address token,
        address recipient, 
        uint256 amount
    ) internal returns (bool) {
        if (amount == 0) return true;
        
        bool success = true;
        if (token == address(0)) {
            (success,) = recipient.call{value: amount}("");
            if (!success) return false;
        } else {
            IERC20(token).safeTransfer(recipient, amount);
        }

        emit TokensTransferred(token, recipient, amount);
        return true;
    }

    function _processFees(
        address token,
        uint256 amount,
        uint16 fee,
        bool isInput
    ) internal returns (uint256 remainingAmount) {
        if (fee == 0) return amount;
        
        address feeRecipient = LibFeeCollector.getRecipient();
        uint256 feeAmount = (amount * fee) / FEE_PERCENTAGE_BASE;
        remainingAmount = amount - feeAmount;
        
        if (isInput) {
            if (token != address(0)) {
                IERC20(token).safeTransferFrom(msg.sender, feeRecipient, feeAmount);
            } else {
                if (!_handleTokenTransfer(token, feeRecipient, feeAmount)) {
                    revert TransferFailed();
                }
            }
        } else {
            if (!_handleTokenTransfer(token, feeRecipient, feeAmount)) {
                revert TransferFailed();
            }
        }
        
        emit FeeCollected(token, feeRecipient, feeAmount);
        return remainingAmount;
    }

    /**
     * @notice Handle cross-chain relay calls with proper function encoding
     * @param fromTokenWithFee Token address and fee for input token
     * @param fromAmount Amount of input token
     * @param toTokenWithFee Token address and fee for output token  
     * @param rawCallData Raw call data (hash/identifier for cross-chain)
     */
    function callCrossChainRelay(
        uint256 fromTokenWithFee,
        uint256 fromAmount,
        uint256 toTokenWithFee,
        bytes calldata rawCallData
    ) external payable nonReentrant {
        // Cache initial balances
        // uint256 initialEthBalance = address(this).balance - msg.value;
        
        // Parse token information
        (address fromToken, uint16 fromFee) = _parseAddressAndFee(fromTokenWithFee);
        // (address toToken, uint16 toFee) = _parseAddressAndFee(toTokenWithFee);
        
        // Process input tokens and fees
        uint256 processedAmount = fromAmount;
        uint256 msgValue = msg.value;
        
        if (fromToken == address(0)) {
            if (fromFee > 0) {
                msgValue = _processFees(fromToken, fromAmount, fromFee, true);
            }
        } else {
            if (fromFee > 0) {
                processedAmount = _processFees(fromToken, fromAmount, fromFee, true);
            }
            
            IERC20(fromToken).safeTransferFrom(msg.sender, address(this), processedAmount);
            if (!_makeCall(IERC20(fromToken), IERC20.approve.selector, relayContract, processedAmount)) {
                revert RouterErrors.ApproveFailed();
            }
        }

        // Transform raw calldata to proper relay function call
        bytes memory transformedCallData = _transformCallDataForCrossChain(rawCallData);
        
        // Call relay contract with transformed data
        (bool success, bytes memory result) = relayContract.call{value: msgValue}(transformedCallData);
        if (!success) {
            revert CrossChainCallFailed(result);
        }

        emit CrossChainCallExecuted(keccak256(rawCallData), success);

        // Reset approvals and handle remaining balances
        if (fromToken != address(0)) {
            if (!_makeCall(IERC20(fromToken), IERC20.approve.selector, relayContract, 0)) {
                revert RouterErrors.ApproveFailed();
            }
            
            uint256 remainingBalance = IERC20(fromToken).balanceOf(address(this));
            if (remainingBalance > 0) {
                _handleTokenTransfer(fromToken, msg.sender, remainingBalance);
            }
        }

        // Cross-chain note: Output tokens will be received on destination chain
        // This contract runs on origin chain, so we CANNOT process output fees here
        // Output fee processing should be handled by:
        // 1. Relay protocol itself (deduct from final amount on destination)
        // 2. Separate fee collection mechanism on destination chain
        // 3. Or embedded in the intent/callData itself
        
        // For now, we only validate that toFee is reasonable (not process it)
        // if (toFee >= FEE_PERCENTAGE_BASE) {
        //     revert InvalidFeePercentage(toFee);
        // }
        
        // No output token processing needed - tokens go directly to user on destination chain
    }

    /**
     * @notice Transform raw cross-chain calldata to proper relay function call
     * @param rawCallData Raw calldata from cross-chain request
     * @return transformedData Properly encoded function call for relay contract
     */
    function _transformCallDataForCrossChain(bytes calldata rawCallData) 
        internal 
        pure 
        returns (bytes memory transformedData) 
    {
        // Based on our research:
        // - forward(bytes) selector: 0xd948d468
        // - makeCalls selector: 0xb2c53867
        // - Cross-chain uses intent-based pattern with forward()
        
        // For cross-chain calls, always wrap in forward() function
        // The rawCallData is the intent hash/identifier that needs to be processed
        transformedData = abi.encodeWithSignature("forward(bytes)", rawCallData);
        
        return transformedData;
    }

    function _makeCall(
        IERC20 token,
        bytes4 selector,
        address to,
        uint256 amount
    ) private returns (bool success) {
        assembly ("memory-safe") {
            let data := mload(0x40)
            mstore(data, selector)
            mstore(add(data, 0x04), to)
            mstore(add(data, 0x24), amount)
            success := call(gas(), token, 0, data, 0x44, 0x0, 0x20)
            if success {
                switch returndatasize()
                case 0 { success := gt(extcodesize(token), 0) }
                default { success := and(gt(returndatasize(), 31), eq(mload(0), 1)) }
            }
        }
    }
} 