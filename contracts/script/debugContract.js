const { ethers } = require("hardhat");

async function main() {
    const contractAddress = process.env.CONTRACT_ADDRESS || "0x6aa9C6C1aD4c9f5e90bfAE6af239F64f7e156db7";
    const contractName = process.env.CONTRACT_NAME || "RelayProxyFacet";
    
    console.log(`🔍 Debugging contract at: ${contractAddress}`);
    console.log(`📋 Contract Name: ${contractName}\n`);
    
    // Check if there's code at the address
    const code = await ethers.provider.getCode(contractAddress);
    console.log(`📄 Contract code length: ${code.length} chars`);
    console.log(`📄 Has code: ${code !== '0x'}`);
    
    if (code === '0x') {
        console.log(`❌ No contract found at address ${contractAddress}`);
        return;
    }
    
    console.log(`📄 Code preview: ${code.slice(0, 100)}...`);
    
    try {
        // Try to get contract factory and ABI
        const ContractFactory = await ethers.getContractFactory(contractName);
        console.log(`\n📋 Contract ABI functions:`);
        
        const abi = ContractFactory.interface;
        const functions = Object.keys(abi.functions);
        console.log(`   Found ${functions.length} functions in ABI:`);
        functions.forEach((func, index) => {
            const signature = abi.functions[func];
            const selector = abi.getSighash(signature);
            console.log(`   ${index + 1}. ${func} -> ${selector}`);
        });
        
        // Try to get contract instance
        const contract = await ethers.getContractAt(contractName, contractAddress);
        console.log(`\n✅ Contract instance created successfully`);
        
        // Try to call a function if it exists
        if (functions.includes('callRelay(uint256,uint256,uint256,bytes)')) {
            console.log(`\n🧪 Testing callRelay function existence...`);
            try {
                // Just check if function exists without calling it
                const callRelayFragment = contract.interface.getFunction('callRelay');
                console.log(`✅ callRelay function found: ${callRelayFragment.format()}`);
            } catch (e) {
                console.log(`❌ callRelay function error: ${e.message}`);
            }
        }
        
    } catch (error) {
        console.log(`❌ Error getting contract factory: ${error.message}`);
    }
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ Error:", error);
            process.exit(1);
        });
} 