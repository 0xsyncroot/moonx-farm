const fs = require('fs');
const path = require('path');
const { deployDiamond } = require('./deploy.js');

async function deployAndVerify() {
    console.log('Starting deployment to Base network...');
    
    try {
        // Deploy the diamond
        const addresses = await deployDiamond();
        
        // Save deployment addresses for Base network
        const deploymentData = {
            network: 'base',
            chainId: 8453,
            timestamp: new Date().toISOString(),
            deployer: (await ethers.getSigners())[0].address,
            addresses: addresses
        };
        
        // Save to deployed-addresses.json
        const deployedAddressesPath = path.join(__dirname, '../deployed-addresses.json');
        fs.writeFileSync(deployedAddressesPath, JSON.stringify(deploymentData, null, 2));
        
        console.log('\nDeployment completed successfully!');
        console.log('Main Diamond Address:', addresses.diamond);
        console.log('DiamondCut Facet:', addresses.diamondCutFacet);
        console.log('Diamond Init:', addresses.diamondInit);
        
        // Get deployer address for constructor arguments
        const [deployer] = await ethers.getSigners();
        
        console.log('\n=== VERIFICATION COMMANDS ===');
        console.log('\nTo verify the CastWatchDiamond contract, run:');
        console.log(`npx hardhat verify --network base ${addresses.diamond} "${deployer.address}" "${addresses.diamondCutFacet}"`);
        
        console.log('\nTo verify the DiamondCutFacet, run:');
        console.log(`npx hardhat verify --network base ${addresses.diamondCutFacet}`);
        
        console.log('\nTo verify the DiamondInit, run:');
        console.log(`npx hardhat verify --network base ${addresses.diamondInit}`);
        
        // Create verification script
        const verificationScript = `#!/bin/bash
# Verification script for Base network deployment

echo "Verifying CastWatchDiamond..."
npx hardhat verify --network base ${addresses.diamond} "${deployer.address}" "${addresses.diamondCutFacet}"

echo "Verifying DiamondCutFacet..."
npx hardhat verify --network base ${addresses.diamondCutFacet}

echo "Verifying DiamondInit..."
npx hardhat verify --network base ${addresses.diamondInit}

echo "Verification completed!"
`;

        fs.writeFileSync(path.join(__dirname, 'verify-base-contracts.sh'), verificationScript);
        console.log('\nVerification script saved to: scripts/verify-base-contracts.sh');
        
        return addresses;
        
    } catch (error) {
        console.error('Deployment failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    deployAndVerify()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { deployAndVerify };