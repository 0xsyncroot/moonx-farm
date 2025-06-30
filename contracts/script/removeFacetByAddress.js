const { getSelectors, FacetCutAction } = require('./libraries/diamond.js')
const { ethers } = require("hardhat");

/**
 * Script để remove facet bằng địa chỉ cụ thể
 * Usage: DIAMOND_ADDRESS=0x... FACET_ADDRESS=0x... npx hardhat run script/removeFacetByAddress.js --network <network>
 */

async function getFacetsInDiamond(diamondAddress) {
    console.log(`🔍 Getting facets in diamond: ${diamondAddress}`);
    
    const diamondLoupe = await ethers.getContractAt("IDiamondLoupe", diamondAddress);
    const facets = await diamondLoupe.facets();
    
    console.log(`📋 Found ${facets.length} facets:`);
    facets.forEach((facet, index) => {
        console.log(`   ${index + 1}. ${facet.facetAddress} - ${facet.functionSelectors.length} functions`);
    });
    
    return facets;
}

async function removeFacetByAddress(diamondAddress, facetAddress) {
    console.log(`\n🗑️  Removing facet at address: ${facetAddress}`);
    
    const [owner] = await ethers.getSigners();
    const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
    const diamondLoupe = await ethers.getContractAt("IDiamondLoupe", diamondAddress);
    
    // Get function selectors của facet cần remove
    const facets = await diamondLoupe.facets();
    const targetFacet = facets.find(f => f.facetAddress.toLowerCase() === facetAddress.toLowerCase());
    
    if (!targetFacet) {
        throw new Error(`❌ Facet with address ${facetAddress} not found in diamond`);
    }
    
    console.log(`📋 Found facet with ${targetFacet.functionSelectors.length} function selectors`);
    
    // Prepare cut để remove
    const cut = [{
        facetAddress: ethers.constants.AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: targetFacet.functionSelectors
    }];
    
    // Remove facet từ diamond
    const tx = await diamondCut.diamondCut(cut, ethers.constants.AddressZero, "0x");
    await tx.wait();
    
    console.log(`✅ Successfully removed facet ${facetAddress} from diamond`);
    console.log(`Transaction hash: ${tx.hash}`);
}

async function main() {
    console.log("🚀 Starting facet removal by address...\n");
    
    // Validate environment variables
    const diamondAddress = process.env.DIAMOND_ADDRESS;
    const facetAddress = process.env.FACET_ADDRESS;
    
    if (!diamondAddress) {
        throw new Error("❌ DIAMOND_ADDRESS environment variable is required");
    }
    
    if (!facetAddress) {
        throw new Error("❌ FACET_ADDRESS environment variable is required");
    }
    
    console.log(`📋 Configuration:`);
    console.log(`   Diamond Address: ${diamondAddress}`);
    console.log(`   Facet Address to Remove: ${facetAddress}`);
    
    const [owner] = await ethers.getSigners();
    console.log(`   Owner: ${owner.address}\n`);
    
    try {
        // Step 1: List current facets
        await getFacetsInDiamond(diamondAddress);
        
        // Step 2: Remove specific facet
        await removeFacetByAddress(diamondAddress, facetAddress);
        
        // Step 3: List facets after removal
        console.log(`\n📋 Facets after removal:`);
        await getFacetsInDiamond(diamondAddress);
        
        console.log(`\n🎉 Successfully removed facet!`);
        
    } catch (error) {
        console.error(`\n❌ Error during facet removal:`, error);
        throw error;
    }
}

if (require.main === module) {
    main()
        .then(() => {
            console.log("\n✅ Script completed successfully");
            process.exit(0);
        })
        .catch((error) => {
            console.error("\n❌ Script failed:", error);
            process.exit(1);
        });
}

module.exports = {
    removeFacetByAddress,
    getFacetsInDiamond
}; 