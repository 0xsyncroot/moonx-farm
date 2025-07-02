const { FacetCutAction } = require('./libraries/diamond.js')
const { ethers } = require("hardhat");

/**
 * Script đơn giản để add facet với selectors manual
 * Usage: DIAMOND_ADDRESS=0x... FACET_ADDRESS=0x... SELECTORS=0x74239163 npx hardhat run script/addFacetSimple.js --network <network>
 */

async function addFacetSimple(diamondAddress, facetAddress, selectors) {
    console.log(`\n➕ Adding facet to diamond...`);
    console.log(`   Diamond: ${diamondAddress}`);
    console.log(`   Facet: ${facetAddress}`);
    console.log(`   Selectors: ${selectors.join(', ')}`);
    
    const [owner] = await ethers.getSigners();
    const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
    
    // Check for conflicts first
    const diamondLoupe = await ethers.getContractAt("IDiamondLoupe", diamondAddress);
    const existingFacets = await diamondLoupe.facets();
    
    console.log(`\n🔍 Checking for conflicts...`);
    const conflicts = [];
    selectors.forEach(selector => {
        existingFacets.forEach(facet => {
            if (facet.functionSelectors.includes(selector)) {
                conflicts.push({
                    selector,
                    existingFacet: facet.facetAddress
                });
            }
        });
    });
    
    if (conflicts.length > 0) {
        console.log(`\n⚠️  Found ${conflicts.length} conflicting selectors:`);
        conflicts.forEach(conflict => {
            console.log(`   ${conflict.selector} exists in ${conflict.existingFacet}`);
        });
        throw new Error(`❌ Remove conflicting facets first!`);
    }
    
    // Prepare cut để add
    const cut = [{
        facetAddress: facetAddress,
        action: FacetCutAction.Add,
        functionSelectors: selectors
    }];
    
    // Add facet vào diamond
    console.log(`\n🔗 Adding facet to diamond...`);
    const tx = await diamondCut.diamondCut(cut, ethers.constants.AddressZero, "0x");
    await tx.wait();
    
    console.log(`✅ Successfully added facet to diamond!`);
    console.log(`📋 Transaction hash: ${tx.hash}`);
}

async function main() {
    console.log("🚀 Adding facet with manual selectors...\n");
    
    const diamondAddress = process.env.DIAMOND_ADDRESS;
    const facetAddress = process.env.FACET_ADDRESS;
    const selectorsInput = process.env.SELECTORS;
    
    if (!diamondAddress || !facetAddress || !selectorsInput) {
        console.log("❌ Required environment variables:");
        console.log("   DIAMOND_ADDRESS=0x...");
        console.log("   FACET_ADDRESS=0x...");
        console.log("   SELECTORS=0x74239163,0x...");
        process.exit(1);
    }
    
    // Parse selectors (comma separated)
    const selectors = selectorsInput.split(',').map(s => s.trim());
    
    console.log(`📋 Configuration:`);
    console.log(`   Diamond: ${diamondAddress}`);
    console.log(`   Facet: ${facetAddress}`);
    console.log(`   Selectors: ${selectors.join(', ')}`);
    
    const [owner] = await ethers.getSigners();
    console.log(`   Owner: ${owner.address}`);
    
    try {
        await addFacetSimple(diamondAddress, facetAddress, selectors);
        console.log(`\n🎉 Success!`);
    } catch (error) {
        console.error(`\n❌ Error:`, error.message);
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