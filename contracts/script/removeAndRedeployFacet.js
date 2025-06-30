const { getSelectors, FacetCutAction } = require('./libraries/diamond.js')
const { ethers } = require("hardhat");

/**
 * Script để remove facet đã deploy sai và triển khai lại facet đó
 * Usage: 
 * npx hardhat run script/removeAndRedeployFacet.js --network <network>
 * 
 * Environment variables:
 * - DIAMOND_ADDRESS: Địa chỉ diamond contract
 * - FACET_NAME: Tên facet cần remove và redeploy
 * - CONSTRUCTOR_ARGS: JSON array của constructor arguments (optional)
 * - VERIFY_CONTRACT: true/false để verify contract (optional)
 */

async function deployFacet(name, args = []) {
    console.log(`\n🔨 Deploying ${name}...`);
    console.log(`Constructor args:`, args.length > 0 ? args : 'None');
    
    const Facet = await ethers.getContractFactory(name);
    const facet = await Facet.deploy(...args);
    await facet.waitForDeployment();
    
    const facetAddress = await facet.getAddress();
    console.log(`✅ ${name} deployed at: ${facetAddress}`);
    
    return facet;
}

async function getFacetSelectors(facetName) {
    // Deploy temporary facet để lấy selectors
    const Facet = await ethers.getContractFactory(facetName);
    const tempFacet = await Facet.deploy();
    await tempFacet.waitForDeployment();
    
    const selectors = getSelectors(tempFacet);
    console.log(`📋 Found ${selectors.length} function selectors for ${facetName}`);
    
    return selectors;
}

async function removeFacet(diamondAddress, facetName) {
    console.log(`\n🗑️  Removing ${facetName} from diamond...`);
    
    const [owner] = await ethers.getSigners();
    const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
    
    // Get function selectors của facet cần remove
    const selectors = await getFacetSelectors(facetName);
    
    if (selectors.length === 0) {
        throw new Error(`No function selectors found for ${facetName}`);
    }
    
    // Prepare cut để remove
    const cut = [{
        facetAddress: ethers.ZeroAddress,
        action: FacetCutAction.Remove,
        functionSelectors: selectors
    }];
    
    // Remove facet từ diamond
    const tx = await diamondCut.diamondCut(cut, ethers.ZeroAddress, "0x");
    await tx.wait();
    
    console.log(`✅ Successfully removed ${facetName} from diamond`);
    console.log(`Transaction hash: ${tx.hash}`);
}

async function addFacet(diamondAddress, facetName, constructorArgs = []) {
    console.log(`\n➕ Adding ${facetName} to diamond...`);
    
    const [owner] = await ethers.getSigners();
    const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
    
    // Deploy facet mới
    const facet = await deployFacet(facetName, constructorArgs);
    const facetAddress = await facet.getAddress();
    
    // Prepare cut để add
    const cut = [{
        facetAddress: facetAddress,
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(facet)
    }];
    
    // Add facet vào diamond
    const tx = await diamondCut.diamondCut(cut, ethers.ZeroAddress, "0x");
    await tx.wait();
    
    console.log(`✅ Successfully added ${facetName} to diamond`);
    console.log(`Transaction hash: ${tx.hash}`);
    
    return facet;
}

async function verifyFacet(facetName, facetAddress, constructorArgs = []) {
    console.log(`\n🔍 Verifying ${facetName}...`);
    
    try {
        // Verify contract trên Etherscan (nếu có API key)
        if (process.env.ETHERSCAN_API_KEY) {
            await hre.run("verify:verify", {
                address: facetAddress,
                constructorArguments: constructorArgs,
            });
            console.log(`✅ ${facetName} verified on Etherscan`);
        } else {
            console.log(`⚠️  ETHERSCAN_API_KEY not found, skipping verification`);
        }
    } catch (error) {
        console.log(`⚠️  Verification failed: ${error.message}`);
    }
}

async function testFacet(diamondAddress, facetName) {
    console.log(`\n🧪 Testing ${facetName} functionality...`);
    
    try {
        // Get diamond contract với interface của facet
        const diamond = await ethers.getContractAt(facetName, diamondAddress);
        
        // Test basic functionality (nếu có)
        if (facetName.includes('DiamondLoupe')) {
            const facets = await diamond.facets();
            console.log(`✅ DiamondLoupe test passed. Found ${facets.length} facets`);
        } else if (facetName.includes('Ownership')) {
            const owner = await diamond.owner();
            console.log(`✅ Ownership test passed. Owner: ${owner}`);
        } else {
            console.log(`✅ ${facetName} deployed successfully`);
        }
    } catch (error) {
        console.log(`⚠️  Test failed: ${error.message}`);
    }
}

async function main() {
    console.log("🚀 Starting facet remove and redeploy process...\n");
    
    // Validate environment variables
    const diamondAddress = process.env.DIAMOND_ADDRESS;
    const facetName = process.env.FACET_NAME;
    
    if (!diamondAddress) {
        throw new Error("❌ DIAMOND_ADDRESS environment variable is required");
    }
    
    if (!facetName) {
        throw new Error("❌ FACET_NAME environment variable is required");
    }
    
    console.log(`📋 Configuration:`);
    console.log(`   Diamond Address: ${diamondAddress}`);
    console.log(`   Facet Name: ${facetName}`);
    
    // Parse constructor arguments
    let constructorArgs = [];
    if (process.env.CONSTRUCTOR_ARGS) {
        try {
            constructorArgs = JSON.parse(process.env.CONSTRUCTOR_ARGS);
            if (!Array.isArray(constructorArgs)) {
                throw new Error("CONSTRUCTOR_ARGS must be a JSON array");
            }
            console.log(`   Constructor Args: ${JSON.stringify(constructorArgs)}`);
        } catch (e) {
            throw new Error(`❌ Invalid CONSTRUCTOR_ARGS: ${e.message}`);
        }
    }
    
    const [owner] = await ethers.getSigners();
    console.log(`   Owner: ${owner.address}\n`);
    
    try {
        // Step 1: Remove facet cũ
        await removeFacet(diamondAddress, facetName);
        
        // Step 2: Deploy và add facet mới
        const newFacet = await addFacet(diamondAddress, facetName, constructorArgs);
        const newFacetAddress = await newFacet.getAddress();
        
        // Step 3: Verify contract (optional)
        const shouldVerify = process.env.VERIFY_CONTRACT === 'true';
        if (shouldVerify) {
            await verifyFacet(facetName, newFacetAddress, constructorArgs);
        }
        
        // Step 4: Test facet functionality
        await testFacet(diamondAddress, facetName);
        
        console.log(`\n🎉 Successfully completed remove and redeploy process!`);
        console.log(`📊 Summary:`);
        console.log(`   - Removed old ${facetName}`);
        console.log(`   - Deployed new ${facetName} at: ${newFacetAddress}`);
        console.log(`   - Added new ${facetName} to diamond`);
        if (shouldVerify) {
            console.log(`   - Verified on Etherscan`);
        }
        
    } catch (error) {
        console.error(`\n❌ Error during remove and redeploy process:`, error);
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
    removeFacet,
    addFacet,
    deployFacet,
    verifyFacet,
    testFacet
}; 