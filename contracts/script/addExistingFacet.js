const { getSelectors, FacetCutAction } = require('./libraries/diamond.js')
const { ethers } = require("hardhat");

/**
 * Script để add facet đã deploy vào diamond
 * Usage: DIAMOND_ADDRESS=0x... FACET_ADDRESS=0x... FACET_NAME=FacetName npx hardhat run script/addExistingFacet.js --network <network>
 */

async function getFacetsInDiamond(diamondAddress) {
    console.log(`🔍 Getting current facets in diamond: ${diamondAddress}`);
    
    const diamondLoupe = await ethers.getContractAt("IDiamondLoupe", diamondAddress);
    const facets = await diamondLoupe.facets();
    
    console.log(`📋 Current facets (${facets.length}):`);
    facets.forEach((facet, index) => {
        console.log(`   ${index + 1}. ${facet.facetAddress} - ${facet.functionSelectors.length} functions`);
    });
    
    return facets;
}

async function addExistingFacet(diamondAddress, facetAddress, facetName) {
    console.log(`\n➕ Adding existing facet to diamond...`);
    console.log(`   Facet Address: ${facetAddress}`);
    console.log(`   Facet Name: ${facetName}`);
    
    const [owner] = await ethers.getSigners();
    const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
    
    // Get facet contract để lấy selectors
    const facet = await ethers.getContractAt(facetName, facetAddress);
    
    // Try using getSelectors from library first
    let selectors = [];
    try {
        const allSelectors = getSelectors(facet);
        selectors = allSelectors.filter(s => s && s !== '0x');
    } catch (e) {
        console.log(`⚠️  getSelectors library failed: ${e.message}`);
    }
    
    // If library fails, manually get selectors from ABI
    if (selectors.length === 0) {
        console.log(`📋 Manually extracting selectors from ABI...`);
        const ContractFactory = await ethers.getContractFactory(facetName);
        const abi = ContractFactory.interface;
        const functions = Object.keys(abi.functions);
        
        selectors = functions.map(func => {
            const signature = abi.functions[func];
            return abi.getSighash(signature);
        }).filter(s => s && s !== '0x');
    }
    
    console.log(`📋 Found ${selectors.length} valid function selectors for ${facetName}`);
    console.log(`   Selectors: ${selectors.map(s => s.slice(0, 10)).join(', ')}`);
    
    if (selectors.length === 0) {
        throw new Error(`❌ No valid function selectors found for ${facetName}`);
    }
    
    // Check if selectors already exist in diamond
    const diamondLoupe = await ethers.getContractAt("IDiamondLoupe", diamondAddress);
    const existingFacets = await diamondLoupe.facets();
    
    const conflictingSelectors = [];
    selectors.forEach(selector => {
        existingFacets.forEach(existingFacet => {
            if (existingFacet.functionSelectors.includes(selector)) {
                conflictingSelectors.push({
                    selector,
                    existingFacet: existingFacet.facetAddress
                });
            }
        });
    });
    
    if (conflictingSelectors.length > 0) {
        console.log(`\n⚠️  Warning: Found ${conflictingSelectors.length} conflicting selectors:`);
        conflictingSelectors.forEach(conflict => {
            console.log(`   ${conflict.selector} exists in ${conflict.existingFacet}`);
        });
        
        throw new Error(`❌ Cannot add facet: Function selectors already exist in diamond. Remove conflicting facets first.`);
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
    
    console.log(`✅ Successfully added ${facetName} to diamond`);
    console.log(`Transaction hash: ${tx.hash}`);
    
    return facet;
}

async function main() {
    console.log("🚀 Starting add existing facet to diamond...\n");
    
    // Validate environment variables
    const diamondAddress = process.env.DIAMOND_ADDRESS;
    const facetAddress = process.env.FACET_ADDRESS;
    const facetName = process.env.FACET_NAME;
    
    if (!diamondAddress) {
        throw new Error("❌ DIAMOND_ADDRESS environment variable is required");
    }
    
    if (!facetAddress) {
        throw new Error("❌ FACET_ADDRESS environment variable is required");
    }
    
    if (!facetName) {
        throw new Error("❌ FACET_NAME environment variable is required");
    }
    
    console.log(`📋 Configuration:`);
    console.log(`   Diamond Address: ${diamondAddress}`);
    console.log(`   Facet Address: ${facetAddress}`);
    console.log(`   Facet Name: ${facetName}`);
    
    const [owner] = await ethers.getSigners();
    console.log(`   Owner: ${owner.address}\n`);
    
    try {
        // Step 1: List current facets
        await getFacetsInDiamond(diamondAddress);
        
        // Step 2: Add existing facet
        await addExistingFacet(diamondAddress, facetAddress, facetName);
        
        // Step 3: List facets after addition
        console.log(`\n📋 Facets after addition:`);
        await getFacetsInDiamond(diamondAddress);
        
        console.log(`\n🎉 Successfully added existing facet to diamond!`);
        
    } catch (error) {
        console.error(`\n❌ Error during adding facet:`, error);
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
    addExistingFacet,
    getFacetsInDiamond
}; 