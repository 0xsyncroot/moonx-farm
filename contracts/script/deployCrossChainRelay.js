const { getSelectors, FacetCutAction } = require('./libraries/diamond.js')
const { ethers } = require("hardhat");

async function deployCrossChainRelayFacet() {
    console.log("🚀 Deploying CrossChainRelayFacet...\n");
    
    // Configuration
    const diamondAddress = process.env.DIAMOND_ADDRESS || "0x5a96aC4B19E039cBc40cB6eB736069041BaABCC2";
    const relayAddress = process.env.RELAY_ADDRESS || "0xa5F565650890fBA1824Ee0F21EbBbF660a179934";
    
    console.log(`📋 Configuration:`);
    console.log(`   Diamond Address: ${diamondAddress}`);
    console.log(`   Relay Address: ${relayAddress}`);
    
    const [deployer] = await ethers.getSigners();
    console.log(`   Deployer: ${deployer.address}`);
    console.log(`   Network: ${(await ethers.provider.getNetwork()).name}\n`);
    
    try {
        // Step 1: Deploy CrossChainRelayFacet
        console.log("🔨 Deploying CrossChainRelayFacet...");
        const CrossChainRelayFacet = await ethers.getContractFactory("CrossChainRelayFacet");
        const crossChainRelayFacet = await CrossChainRelayFacet.deploy(relayAddress);
        await crossChainRelayFacet.deployed();
        
        console.log(`✅ CrossChainRelayFacet deployed at: ${crossChainRelayFacet.address}`);
        
        // Step 2: Get selectors manually (the library has issues)
        console.log("\n🔍 Getting function selectors...");
        
        // Manual selector calculation for callCrossChainRelay
        const signature = "callCrossChainRelay(uint256,uint256,uint256,bytes)";
        const selector = ethers.utils.id(signature).slice(0, 10);
        const selectors = [selector];
        
        console.log(`✅ Function: ${signature}`);
        console.log(`✅ Selector: ${selector}`);
        
        // Step 3: Add to diamond
        console.log("\n➕ Adding CrossChainRelayFacet to diamond...");
        const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
        
        const cut = [{
            facetAddress: crossChainRelayFacet.address,
            action: FacetCutAction.Add,
            functionSelectors: selectors
        }];
        
        const tx = await diamondCut.diamondCut(cut, ethers.constants.AddressZero, "0x");
        console.log(`⏳ Transaction hash: ${tx.hash}`);
        
        await tx.wait();
        console.log(`✅ CrossChainRelayFacet added to diamond successfully!`);
        
        console.log(`\n🎉 Deployment completed!`);
        console.log(`📊 Summary:`);
        console.log(`   - CrossChainRelayFacet: ${crossChainRelayFacet.address}`);
        console.log(`   - Diamond: ${diamondAddress}`);
        console.log(`   - Selector: ${selector}`);
        
        return crossChainRelayFacet.address;
        
    } catch (error) {
        console.error(`\n❌ Deployment failed:`, error);
        throw error;
    }
}

async function main() {
    return await deployCrossChainRelayFacet();
}

if (require.main === module) {
    main()
        .then((address) => {
            console.log(`\n✅ Script completed. Address: ${address}`);
            process.exit(0);
        })
        .catch((error) => {
            console.error("\n❌ Script failed:", error);
            process.exit(1);
        });
}

module.exports = { deployCrossChainRelayFacet }; 