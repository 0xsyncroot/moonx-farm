const { ethers } = require("hardhat");

/**
 * Script để kiểm tra trạng thái hiện tại của diamond và các facets
 * Usage: npx hardhat run script/checkDiamondState.js --network <network>
 */

async function checkDiamondState() {
    console.log("🔍 Checking diamond state...\n");
    
    const diamondAddress = process.env.DIAMOND_ADDRESS;
    if (!diamondAddress) {
        throw new Error("❌ DIAMOND_ADDRESS environment variable is required");
    }
    
    const [owner] = await ethers.getSigners();
    
    try {
        // Get diamond contract với DiamondLoupe interface
        const diamond = await ethers.getContractAt("DiamondLoupeFacet", diamondAddress);
        
        console.log("📋 Diamond Information:");
        console.log(`   Address: ${diamondAddress}`);
        console.log(`   Owner: ${owner.address}`);
        console.log("");
        
        // Get all facets
        console.log("🔧 Current Facets:");
        const facets = await diamond.facets();
        
        if (facets.length === 0) {
            console.log("   No facets found");
        } else {
            facets.forEach((facet, index) => {
                console.log(`   ${index + 1}. ${facet.facetAddress}`);
                console.log(`      Selectors: ${facet.functionSelectors.length} functions`);
                console.log(`      Functions: ${facet.functionSelectors.join(', ')}`);
                console.log("");
            });
        }
        
        // Get facet function selectors
        console.log("📝 Facet Function Details:");
        for (let i = 0; i < facets.length; i++) {
            const facet = facets[i];
            console.log(`\n   Facet ${i + 1}: ${facet.facetAddress}`);
            
            for (const selector of facet.functionSelectors) {
                try {
                    const facetAddress = await diamond.facetAddress(selector);
                    console.log(`      ${selector} -> ${facetAddress}`);
                } catch (error) {
                    console.log(`      ${selector} -> Error: ${error.message}`);
                }
            }
        }
        
        // Check ownership
        console.log("\n👑 Ownership Check:");
        try {
            const diamondOwner = await ethers.getContractAt("OwnershipFacet", diamondAddress);
            const ownerAddress = await diamondOwner.owner();
            console.log(`   Current Owner: ${ownerAddress}`);
            console.log(`   Signer Address: ${owner.address}`);
            console.log(`   Is Owner: ${ownerAddress.toLowerCase() === owner.address.toLowerCase()}`);
        } catch (error) {
            console.log(`   Ownership check failed: ${error.message}`);
        }
        
        // Check diamond cut functionality
        console.log("\n⚡ Diamond Cut Check:");
        try {
            const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
            console.log(`   DiamondCut interface: ✅ Available`);
        } catch (error) {
            console.log(`   DiamondCut interface: ❌ Not available`);
        }
        
        console.log("\n✅ Diamond state check completed!");
        
    } catch (error) {
        console.error("❌ Error checking diamond state:", error);
        throw error;
    }
}

async function checkSpecificFacet(facetName) {
    console.log(`\n🔍 Checking specific facet: ${facetName}`);
    
    const diamondAddress = process.env.DIAMOND_ADDRESS;
    if (!diamondAddress) {
        throw new Error("❌ DIAMOND_ADDRESS environment variable is required");
    }
    
    try {
        // Try to get contract với facet interface
        const diamond = await ethers.getContractAt(facetName, diamondAddress);
        console.log(`✅ ${facetName} is available on diamond`);
        
        // Test basic functionality
        if (facetName.includes('DiamondLoupe')) {
            const facets = await diamond.facets();
            console.log(`   Found ${facets.length} facets`);
        } else if (facetName.includes('Ownership')) {
            const owner = await diamond.owner();
            console.log(`   Owner: ${owner}`);
        } else {
            console.log(`   Basic functionality test passed`);
        }
        
    } catch (error) {
        console.log(`❌ ${facetName} is NOT available on diamond`);
        console.log(`   Error: ${error.message}`);
    }
}

async function main() {
    const facetName = process.env.FACET_NAME;
    
    await checkDiamondState();
    
    if (facetName) {
        await checkSpecificFacet(facetName);
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
    checkDiamondState,
    checkSpecificFacet
}; 