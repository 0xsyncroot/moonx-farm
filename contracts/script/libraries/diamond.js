/* global ethers */

const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 }

// get function selectors from ABI
function getSelectors(contract) {
    const functions = contract.interface.fragments.filter(f => f.type === 'function');
    const selectors = functions.reduce((acc, func) => {
        if (func.name !== 'init') {
            try {
                const selector = contract.interface.getSighash(func);
                if (selector) {
                    acc.push(selector);
                }
            } catch (error) {
                console.warn(`Failed to get selector for function ${func.name}:`, error.message);
            }
        }
        return acc;
    }, []);
    selectors.contract = contract;
    selectors.remove = remove;
    selectors.get = get;
    return selectors;
}

// get function selector from function signature
function getSelector(func) {
    const abiInterface = new ethers.utils.Interface([func]);
    return abiInterface.getSighash(func);
}

// used with getSelectors to remove selectors from an array of selectors
// functionNames argument is an array of function signatures
function remove(functionNames) {
    const selectors = this.filter((v) => {
        for (const functionName of functionNames) {
            try {
                const selector = this.contract.interface.getSighash(functionName);
                if (v === selector) {
                    return false;
                }
            } catch (error) {
                console.warn(`Failed to get selector for function ${functionName}:`, error.message);
            }
        }
        return true;
    });
    selectors.contract = this.contract;
    selectors.remove = this.remove;
    selectors.get = this.get;
    return selectors;
}

// used with getSelectors to get selectors from an array of selectors
// functionNames argument is an array of function signatures
function get(functionNames) {
    const selectors = this.filter((v) => {
        for (const functionName of functionNames) {
            try {
                const selector = this.contract.interface.getSighash(functionName);
                if (v === selector) {
                    return true;
                }
            } catch (error) {
                console.warn(`Failed to get selector for function ${functionName}:`, error.message);
            }
        }
        return false;
    });
    selectors.contract = this.contract;
    selectors.remove = this.remove;
    selectors.get = this.get;
    return selectors;
}

// remove selectors using an array of signatures
function removeSelectors(selectors, signatures) {
    const iface = new ethers.utils.Interface(signatures.map(v => 'function ' + v));
    const removeSelectors = signatures.map(v => iface.getSighash(v));
    selectors = selectors.filter(v => !removeSelectors.includes(v));
    return selectors;
}

// find a particular address position in the return value of diamondLoupeFacet.facets()
function findAddressPositionInFacets(facetAddress, facets) {
    for (let i = 0; i < facets.length; i++) {
        if (facets[i].facetAddress === facetAddress) {
            return i;
        }
    }
}

exports.getSelectors = getSelectors;
exports.getSelector = getSelector;
exports.FacetCutAction = FacetCutAction;
exports.remove = remove;
exports.removeSelectors = removeSelectors;
exports.findAddressPositionInFacets = findAddressPositionInFacets;