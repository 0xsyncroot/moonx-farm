const { getSelectors, FacetCutAction } = require('./libraries/diamond.js')
const { ethers } = require("hardhat");

async function debugSelectors() {
    console.log("🔍 Debugging CrossChainRelayFacet selectors...\n");
    
    const relayAddress = process.env.RELAY_ADDRESS || "0xa5F565650890fBA1824Ee0F21EbBbF660a179934";
    
    try {
        // Deploy CrossChainRelayFacet
        console.log("🔨 Deploying CrossChainRelayFacet...");
        const CrossChainRelayFacet = await ethers.getContractFactory("CrossChainRelayFacet");
        const crossChainRelayFacet = await CrossChainRelayFacet.deploy(relayAddress);
        await crossChainRelayFacet.deployed();
        
        console.log(`✅ CrossChainRelayFacet deployed at: ${crossChainRelayFacet.address}\n`);
        
        // Debug interface
        console.log("🔍 Debugging interface...");
        console.log("Interface fragments:", crossChainRelayFacet.interface.fragments.length);
        
        // Show all fragments
        crossChainRelayFacet.interface.fragments.forEach((fragment, index) => {
            console.log(`  ${index + 1}. Type: ${fragment.type}, Name: ${fragment.name || 'N/A'}`);
            if (fragment.type === 'function') {
                try {
                    const selector = crossChainRelayFacet.interface.getFunction(fragment.name).selector;
                    console.log(`      Selector: ${selector}`);
                } catch (e) {
                    console.log(`      Selector Error: ${e.message}`);
                }
            }
        });
        
        // Get selectors using the library function
        console.log("\n🔍 Testing getSelectors function...");
        const selectors = getSelectors(crossChainRelayFacet);
        
        console.log(`Found ${selectors.length} selectors:`);
        selectors.forEach((selector, index) => {
            console.log(`  ${index + 1}. ${selector} (type: ${typeof selector})`);
            if (selector === undefined || selector === null) {
                console.log(`     ❌ FOUND UNDEFINED SELECTOR AT INDEX ${index}!`);
            }
        });
        
        // Validate selectors
        console.log("\n✅ Validation complete!");
        console.log(`Valid selectors: ${selectors.filter(s => s !== undefined && s !== null).length}`);
        console.log(`Invalid selectors: ${selectors.filter(s => s === undefined || s === null).length}`);
        
    } catch (error) {
        console.error(`\n❌ Debug failed:`, error);
    }
}

if (require.main === module) {
    debugSelectors()
        .then(() => {
            console.log(`\n✅ Debug completed.`);
            process.exit(0);
        })
        .catch((error) => {
            console.error("\n❌ Debug failed:", error);
            process.exit(1);
        });
}

module.exports = { debugSelectors }; 