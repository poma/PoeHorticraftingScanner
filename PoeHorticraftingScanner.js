const axios = require('axios')
const config = require('./config.json')

const fullOutput = process.env.FULL_OUTPUT

// Order used to sort crafting categories
const categoryOrder = [
  'Special',
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

  return data.data.items ? data.data.items.filter(item => item.typeLine === 'Horticrafting Station' && item.craftedMods) : [];
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
  const level = craft.match(/\((\d+)\)$/)[1]
  const result = {
    level,
    text: craft,
    lucky: craft.indexOf('Lucky') > -1,
  }
  if (craft.startsWith('Augment ')) {
    result.category = 'Augment'
    result.subcategory = craft.match(/^Augment .* (\w+) modifier /)[1]
  } else if (craft.startsWith('Randomise ')) {
    result.category = 'Randomise'
    result.subcategory = craft.match(/^Randomise the numeric values .* (\w+) modifiers /)[1]
  } else if (craft.startsWith('Change a modifier ')) {
    result.category = 'Change Resists'
    const match = craft.match(/^Change .* grants (\w+) Resistance into .* (\w+) Resistance/)
    result.subcategory = `${match[1]} -> ${match[2]}`
  } else if (craft.startsWith('Remove ')) {
    const match = craft.match(/^Remove a random (?<non>non-)?(?<mod>\w+) modifier from an item (?<add>and .*)?\(/).groups
    if (!match.add) {
      result.category = 'Remove'
      result.subcategory = match.mod
    } else {
      result.category = match.non ? 'Remove Non-/Add' : 'Remove/Add'
      result.subcategory = match.mod
    }
  } else if (craft.startsWith('Fracture ')) {
    result.category = 'Special'
    result.subcategory = 'Fracture ' + craft.match(/^Fracture a random (\w+) /)[1]
  } else if (craft.startsWith('Synthesise ')) {
    result.category = 'Special'
    result.subcategory = 'Synthesise an item'
  } else if (craft.startsWith('Add a random Influence ')) {
    result.category = 'Special'
    result.subcategory = 'Influence ' + craft.match(/Rare (\w+) that/)[1]
  } else {
    result.category = 'Other'
    result.subcategory = result.text
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
  const stations = config.tab ? await fetchTab(config.tab) : await fetchAllTabs()
  let crafts = stations.map(x => x.craftedMods).flat().map(x => stringToCraft(x))

  if (!fullOutput && config.header) {
    console.log(config.header)
  }
  crafts = groupBy(crafts, 'category')
  for (const category of Object.keys(crafts).sort(priorityCompare(categoryOrder))) {
    if (!fullOutput && config.hideCategories.includes(category)) {
      continue
    }
    console.log()
    console.log(fullOutput ? `# ${category}` : `**__${category}:__**`)
    crafts[category] = groupBy(crafts[category], 'subcategory')
    for (const subcategory of Object.keys(crafts[category]).sort(priorityCompare(subcategoryOrder))) {
      if (!fullOutput) {
        const items = crafts[category][subcategory].filter(x => x.level >= config.hideLevelUnder)
        const lucky = items.filter(x => x.lucky).length
        const normal = items.length - lucky
        const count = `${normal ? `x${normal}` : ''}${normal && lucky ? ' + ' : ''}${lucky ? `x${lucky} Lucky` : ''}`
        let price = fetchPrice(category, subcategory)
        if (lucky && normal) {
          price = `${price} (Lucky +${config.luckyPrice})`
        } else if (lucky) {
          price = `${price} + ${config.luckyPrice}`
        }
        if (items.length === 0) {
          continue
        }
        console.log(`${subcategory} (${count}): **${price}**`)
      } else {
        for (const craft of crafts[category][subcategory]) {
          console.log(craft.text)
        }
      }
    }
  }
  if (!fullOutput) {
    console.log()
    console.log('*Up to date craft list is created by PoeHorticraftingScanner script*')
  }
  process.exit(0)
}

main()
