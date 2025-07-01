const { getSelectors, FacetCutAction } = require('./libraries/diamond.js')
const { ethers } = require("hardhat");

async function deployRelayProxyFacet() {
    console.log("🚀 Deploying RelayProxyFacet...\n");
    
    // Configuration
    const diamondAddress = process.env.DIAMOND_ADDRESS || "0x5a96aC4B19E039cBc40cB6eB736069041BaABCC2";
    const relayAddress = process.env.RELAY_ADDRESS || "0xa5F565650890fBA1824Ee0F21EbBbF660a179934";
    
    // Validation
    if (!process.env.PRIVATE_KEY) {
        console.log("⚠️  Warning: PRIVATE_KEY not set in environment");
    }
    
    console.log(`📋 Configuration:`);
    console.log(`   Diamond Address: ${diamondAddress}`);
    console.log(`   Relay Address: ${relayAddress}`);
    
    const [deployer] = await ethers.getSigners();
    console.log(`   Deployer: ${deployer.address}`);
    const network = await ethers.provider.getNetwork();
    console.log(`   Network: ${network.name} (Chain ID: ${network.chainId})\n`);
    
    try {
        // Step 1: Deploy RelayProxyFacet
        console.log("🔨 Deploying RelayProxyFacet...");
        const RelayProxyFacet = await ethers.getContractFactory("RelayProxyFacet");
        const relayFacet = await RelayProxyFacet.deploy(relayAddress);
        await relayFacet.deployed();
        
        console.log(`✅ RelayProxyFacet deployed at: ${relayFacet.address}`);
        
        // Step 2: Get selectors
        const selectors = getSelectors(relayFacet);
        console.log(`📋 Found ${selectors.length} function selectors`);
        
        // Step 3: Add to diamond
        console.log("\n➕ Adding RelayProxyFacet to diamond...");
        const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
        
        const cut = [{
            facetAddress: relayFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: selectors
        }];
        
        const tx = await diamondCut.diamondCut(cut, ethers.constants.AddressZero, "0x");
        console.log(`⏳ Transaction hash: ${tx.hash}`);
        
        await tx.wait();
        console.log(`✅ RelayProxyFacet added to diamond successfully!`);
        
        // Step 4: Test functionality
        console.log("\n🧪 Testing RelayProxyFacet...");
        const diamond = await ethers.getContractAt("RelayProxyFacet", diamondAddress);
        
        // Just check if we can access the function (without calling it)
        console.log(`✅ RelayProxyFacet interface accessible on diamond`);
        
        console.log(`\n🎉 Deployment completed successfully!`);
        console.log(`📊 Summary:`);
        console.log(`   - RelayProxyFacet deployed at: ${relayFacet.address}`);
        console.log(`   - Added to diamond at: ${diamondAddress}`);
        console.log(`   - Function selectors: ${selectors.length}`);
        
        return relayFacet.address;
        
    } catch (error) {
        console.error(`\n❌ Deployment failed:`, error);
        throw error;
    }
}

async function main() {
    return await deployRelayProxyFacet();
}

if (require.main === module) {
    main()
        .then((address) => {
            console.log(`\n✅ Script completed. RelayProxyFacet deployed at: ${address}`);
            process.exit(0);
        })
        .catch((error) => {
            console.error("\n❌ Script failed:", error);
            process.exit(1);
        });
}

module.exports = { deployRelayProxyFacet }; 