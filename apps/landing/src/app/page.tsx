'use client'

import { ArrowRight, Shield, Zap, Heart, TrendingUp, Users, Clock, Star, Play, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden">
      {/* Navigation */}
      <nav className="relative z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-xl font-bold text-gradient">
              MoonX Farm
            </span>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-300 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-gray-300 hover:text-white transition-colors">How it Works</a>
            <a href="#about" className="text-gray-300 hover:text-white transition-colors">About</a>
          </div>
          
          <a href="https://app.moonx.farm" target="_blank" rel="noopener noreferrer">
            <Button className="btn-jupiter">
              Launch App
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 py-20 text-center">
        <div className="max-w-5xl mx-auto">
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="floating-orb w-80 h-80 bg-orange-500/20 -top-40 -left-40"></div>
            <div className="floating-orb w-96 h-96 bg-orange-400/15 -bottom-40 -right-40" style={{animationDelay: '1s'}}></div>
            <div className="floating-orb w-64 h-64 bg-purple-500/10 top-20 right-1/4" style={{animationDelay: '2s'}}></div>
          </div>

          <div className="relative z-10">
            {/* Badge */}
            <div className="inline-flex items-center px-4 py-2 rounded-full glass mb-8">
              <Star className="w-4 h-4 text-orange-400 mr-2" />
              <span className="text-sm font-medium">The Future of DEX Trading</span>
            </div>

            {/* Main headline */}
            <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-tight">
              Trade
              <span className="text-gradient"> Gasless</span>
              <br />
              With Smart Wallets
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
              The first multi-aggregator DEX with Account Abstraction. 
              Trade with social login, pay zero gas fees, and get the best prices across all DEXs.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="btn-jupiter text-lg px-8 py-4">
                  Start Trading Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </a>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8 py-4 glass hover:bg-white/20"
              >
                <Play className="mr-2 h-5 w-5" />
                Watch Demo
              </Button>
            </div>

            {/* Trust signals */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-400 mb-2">$2.5M+</div>
                <div className="text-gray-400">Total Volume Traded</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-400 mb-2">10K+</div>
                <div className="text-gray-400">Gasless Transactions</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-400 mb-2">99.9%</div>
                <div className="text-gray-400">Uptime</div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-6 h-6 text-gray-400" />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-6 py-20 bg-black/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Why Choose 
              <span className="text-gradient"> MoonX</span>
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Experience the future of DeFi trading with cutting-edge technology and user-first design
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <Card className="feature-card group">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Zap className="w-6 h-6 text-orange-400" />
                </div>
                <h3 className="text-xl font-bold mb-4">Gasless Trading</h3>
                <p className="text-gray-300 leading-relaxed">
                  Your first 10 trades are completely free. No gas fees, no friction - just pure trading experience.
                </p>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="feature-card group">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Heart className="w-6 h-6 text-orange-400" />
                </div>
                <h3 className="text-xl font-bold mb-4">Social Login</h3>
                <p className="text-gray-300 leading-relaxed">
                  Sign in with Google, Twitter, or email. No seed phrases, no wallet downloads - onboard in seconds.
                </p>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="feature-card group">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-6 h-6 text-orange-400" />
                </div>
                <h3 className="text-xl font-bold mb-4">Best Prices</h3>
                <p className="text-gray-300 leading-relaxed">
                  Multi-aggregator routing across LI.FI, 1inch, and Relay ensures you always get the best rates.
                </p>
              </CardContent>
            </Card>

            {/* Feature 4 */}
            <Card className="feature-card group">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Shield className="w-6 h-6 text-orange-400" />
                </div>
                <h3 className="text-xl font-bold mb-4">MEV Protection</h3>
                <p className="text-gray-300 leading-relaxed">
                  Built-in protection against MEV attacks. Your trades are shielded from front-running and sandwich attacks.
                </p>
              </CardContent>
            </Card>

            {/* Feature 5 */}
            <Card className="feature-card group">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Clock className="w-6 h-6 text-orange-400" />
                </div>
                <h3 className="text-xl font-bold mb-4">Advanced Orders</h3>
                <p className="text-gray-300 leading-relaxed">
                  Set limit orders and DCA strategies. Automate your trading with smart contract execution.
                </p>
              </CardContent>
            </Card>

            {/* Feature 6 */}
            <Card className="feature-card group">
              <CardContent className="p-8">
                <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6 text-orange-400" />
                </div>
                <h3 className="text-xl font-bold mb-4">Multi-Chain</h3>
                <p className="text-gray-300 leading-relaxed">
                  Trade across Base and BSC networks. Seamless cross-chain experience with unified liquidity.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Get Started in 
              <span className="text-gradient"> 30 Seconds</span>
            </h2>
            <p className="text-xl text-gray-300">
              The simplest onboarding experience in DeFi
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="text-center relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                1
              </div>
              <h3 className="text-xl font-bold mb-4">Connect Socially</h3>
              <p className="text-gray-300">
                Sign in with your Google, Twitter, or email account. No downloads required.
              </p>
              
              {/* Connector line */}
              <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-orange-400 to-transparent z-0"></div>
            </div>

            {/* Step 2 */}
            <div className="text-center relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                2
              </div>
              <h3 className="text-xl font-bold mb-4">Smart Wallet Created</h3>
              <p className="text-gray-300">
                Your Account Abstraction wallet is automatically created and secured.
              </p>
              
              {/* Connector line */}
              <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-orange-400 to-transparent z-0"></div>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
                3
              </div>
              <h3 className="text-xl font-bold mb-4">Start Trading</h3>
              <p className="text-gray-300">
                Begin trading immediately with gasless transactions and best prices.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-6 py-20 bg-gradient-to-r from-orange-500/5 to-orange-400/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Trusted by Thousands
            </h2>
            <p className="text-xl text-gray-300">
              Join the growing community of smart traders
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-gradient mb-2">97%</div>
              <div className="text-gray-400">Completion Rate</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-gradient mb-2">&lt;200ms</div>
              <div className="text-gray-400">Quote Speed</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-gradient mb-2">5+</div>
              <div className="text-gray-400">Supported Chains</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-gradient mb-2">24/7</div>
              <div className="text-gray-400">Uptime</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 bg-gradient-to-r from-orange-500/10 to-orange-400/10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Trade Smarter?
          </h2>
          <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
            Join thousands of traders who have discovered the future of DeFi trading. 
            Your first 10 trades are on us.
          </p>
          
          <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="btn-jupiter text-xl px-12 py-6">
              Launch MoonX App
              <ArrowRight className="ml-3 h-6 w-6" />
            </Button>
          </a>
          
          <p className="text-sm text-gray-400 mt-6">
            No installation required • Gasless trading • Social login
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer id="about" className="px-6 py-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 flex items-center justify-center">
                  <span className="text-white font-bold text-xs">M</span>
                </div>
                <span className="text-lg font-bold text-gradient">
                  MoonX Farm
                </span>
              </div>
              <p className="text-gray-400 mb-4 max-w-md">
                The future of DeFi trading with Account Abstraction, gasless transactions, 
                and best-in-class user experience.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a></li>
                <li><a href="http://localhost:3000" className="hover:text-white transition-colors">Trading App</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#about" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Support</a></li>
              </ul>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-white/10">
            <div className="flex items-center space-x-6 text-sm text-gray-400 mb-4 md:mb-0">
              <span>© 2025 MoonX Farm. All rights reserved.</span>
            </div>
            
            <div className="flex items-center space-x-6 text-sm text-gray-400">
              <span>Built with ❤️ for DeFi</span>
              <span>•</span>
              <span>Powered by Account Abstraction</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
} 