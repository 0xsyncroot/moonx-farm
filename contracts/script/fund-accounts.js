const { ethers } = require('hardhat')

async function main() {
  console.log('🚀 Funding test accounts...')
  
  const [deployer] = await ethers.getSigners()
  const network = await ethers.provider.getNetwork()
  
  console.log('Network:', network.name, 'Chain ID:', network.chainId)
  console.log('Deployer:', deployer.address)
  console.log('Deployer balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH')
  
  // Test accounts to fund
  const testAccounts = [
    '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Account #0
    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Account #1
    '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Account #2
    '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // Account #3
    '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',  // Account #4
    '0x34e1890734bbB92A206D672b985Fdd0F2Ed579A8'
  ]
  
  const fundAmount = ethers.parseEther('1000') // 1000 ETH each
  
  for (let i = 0; i < testAccounts.length; i++) {
    const account = testAccounts[i]
    const currentBalance = await ethers.provider.getBalance(account)
    
    console.log(`\nAccount #${i}: ${account}`)
    console.log(`Current balance: ${ethers.formatEther(currentBalance)} ETH`)
    
    if (currentBalance < ethers.parseEther('100')) {
      console.log(`Funding with ${ethers.formatEther(fundAmount)} ETH...`)
      
      try {
        const tx = await deployer.sendTransaction({
          to: account,
          value: fundAmount
        })
        await tx.wait()
        
        const newBalance = await ethers.provider.getBalance(account)
        console.log(`✅ New balance: ${ethers.formatEther(newBalance)} ETH`)
      } catch (error) {
        console.error(`❌ Failed to fund ${account}:`, error.message)
      }
    } else {
      console.log('✅ Account already funded')
    }
  }
  
  console.log('\n🎉 Account funding completed!')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })