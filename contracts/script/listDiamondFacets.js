const { ethers } = require("hardhat");

/**
 * Script để list tất cả facets trong diamond
 * Usage: DIAMOND_ADDRESS=0x... npx hardhat run script/listDiamondFacets.js --network <network>
 */

async function main() {
    const diamondAddress = process.env.DIAMOND_ADDRESS || "0x5a96aC4B19E039cBc40cB6eB736069041BaABCC2";
    
    console.log(`🔍 Listing facets in diamond: ${diamondAddress}\n`);
    
    const diamondLoupe = await ethers.getContractAt("IDiamondLoupe", diamondAddress);
    const facets = await diamondLoupe.facets();
    
    console.log(`📋 Found ${facets.length} facets:\n`);
    
    facets.forEach((facet, index) => {
        console.log(`${index + 1}. Facet Address: ${facet.facetAddress}`);
        console.log(`   Function Selectors: ${facet.functionSelectors.length}`);
        console.log(`   Selectors: ${facet.functionSelectors.map(s => s.slice(0, 10)).join(', ')}`);
        console.log('');
    });
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ Error:", error);
            process.exit(1);
        });
} 