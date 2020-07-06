const axios = require('axios')
const config = require('./config.json')

const fullOutput = process.env.FULL_OUTPUT

// Order used to sort crafting categories
const categoryOrder = [
  'Augment',
  'Remove/Add',
  'Remove',
  'Remove Non-/Add',
  'Change Resists',
  'Randomise',
]

// Order used to sort crafting subcategories
const subcategoryOrder = [
  'Fire -> Cold',
  'Fire -> Lightning',
  'Cold -> Fire',
  'Cold -> Lightning',
  'Lightning -> Fire',
  'Lightning -> Cold',
  'Fire',
  'Cold',
  'Lightning',
  'Chaos',
  'Attack',
  'Caster',
  'Physical',
  'Defence',
  'Life',
]

/**
 * Gets specified stash tabs and returns all horticrafting stations from it
 * @param tab Tab index
 * @returns {Promise<Array>}
 */
async function fetchTab(tab) {
  const data = await axios.get(
    `https://www.pathofexile.com/character-window/get-stash-items?league=Harvest&tabs=1&tabIndex=${tab}&accountName=${config.accountName}`,
    { headers: { Cookie: `POESESSID=${config.POESESSID}` } },
  )

  return data.data.items ? data.data.items.filter(item => item.typeLine === 'Horticrafting Station') : [];
}

/**
 * Fetches all tabs and returns all horticrafting stations from them
 * @returns {Promise<Array>}
 */
async function fetchAllTabs() {
  // Get tab count
  const metadata = await axios.get(
    `https://www.pathofexile.com/character-window/get-stash-items?league=Harvest&accountName=${config.accountName}`,
    { headers: { Cookie: `POESESSID=${config.POESESSID}` } },
  )

  // Fetch all tabs in parallel
  const contents = await Promise.all([...Array(metadata.data.numTabs).keys()].map(i => fetchTab(i)))
  return contents.flat()
}

/**
 * Parses crafting string and creates an object from it
 * @param craft Craft string
 * @returns {{lucky: boolean, level: number, plaintext: string, sourceText: string}}
 */
function stringToCraft(craft) {
  // Tokens = white text pieces
  const tokens = [...craft.matchAll(/<white>{(.*?)}/g)].map(x => x[1])
  const level = craft.match(/\((\d+)\)$/)[1]
  const result = {
    level,
    sourceText: craft,
    plaintext: craft.replace(/<white>/g, '').replace(/[{}]/g, ''),
    lucky: craft.indexOf('Lucky') > -1,
  }
  switch (tokens[0]) {
    case 'Augment':
      result.category = 'Augment'
      result.subcategory = tokens[1]
      break;
    case 'Randomise':
      result.category = 'Randomise'
      result.subcategory = tokens[1]
      break;
    case 'Change':
      result.category = 'Change Resists'
      result.subcategory = `${tokens[1]} -> ${tokens[2]}`
      break;
    case 'Remove':
      if (tokens.length === 2) {
        result.category = 'Remove'
        result.subcategory = tokens[1]
      } else {
        result.category = tokens[1].startsWith('non-') ? 'Remove Non-/Add' : 'Remove/Add'
        result.subcategory = tokens[3]
      }
      break;
    default:
      result.category = 'Other'
      result.subcategory = result.plaintext
      break;
  }
  // nodejs supports optional chaining only starting from v14
  // so we use use a separate function instead
  // result.price =
  //   config.price?.[result.category]?.[result.subcategory] ??
  //   config.price?.[result.category]?.default ??
  //   config.price.default ??
  //   ''
  result.price = fetchPrice(result.category, result.subcategory)
  return result
}

/**
 * Fetch craft price from config with fallback to default values
 * @param category Craft category (example: Remove)
 * @param subcategory Craft subcategory (example: Fire)
 * @returns {string}
 */
function fetchPrice(category, subcategory) {
  if (config.price[category]) {
    if (config.price[category][subcategory]) {
      return config.price[category][subcategory]
    } else {
      return config.price[category].default
    }
  } else {
    return config.price.default
  }
}

/** Groups items array by key */
const groupBy = (items, key) => items.reduce(
  (result, item) => ({
    ...result,
    [item[key]]: [
      ...(result[item[key]] || []),
      item,
    ],
  }),
  {},
);

/** Compare function used to sort array according to supplied order (unknown elements come last) */
const priorityCompare = (order) => (a, b) =>
  (order.indexOf(a) >= 0 ? order.indexOf(a) : 1000) - (order.indexOf(b) >= 0 ? order.indexOf(b) : 1000)

/** Main function, needs refactoring */
async function main() {
  const stations = await fetchAllTabs()
  let crafts = stations.map(x => x.craftedMods).flat().map(x => stringToCraft(x))

  if (!fullOutput) {
    console.log(`[HSC] IGN: @${config.IGN}`)
  }
  crafts = groupBy(crafts, 'category')
  for (const category of Object.keys(crafts).sort(priorityCompare(categoryOrder))) {
    if (!fullOutput && config.hideCategories.includes(category)) {
      continue
    }
    console.log()
    console.log(fullOutput ? `# ${category}` : `**${category}:**`)
    crafts[category] = groupBy(crafts[category], 'subcategory')
    for (const subcategory of Object.keys(crafts[category]).sort(priorityCompare(subcategoryOrder))) {
      if (!fullOutput) {
        const items = crafts[category][subcategory].filter(x => x.level >= config.hideLevelUnder)
        const lucky = items.filter(x => x.lucky).length
        const price = fetchPrice(category, subcategory)
        console.log(`${subcategory} x${items.length}${lucky > 0 ? ` (x${lucky} Lucky)` : ''}: ${price}`)
      } else {
        for (const craft of crafts[category][subcategory]) {
          console.log(craft.plaintext)
        }
      }
    }
  }
  process.exit(0)
}

main()
