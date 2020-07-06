# POE Horticrafting Scanner
Will scan your stash finding all Horticrafting Stations and their crafts formatted for discord trading.

Based on [POE_Horticrafting_Tracker](https://github.com/Corbris/POE_Horticrafting_Tracker) by Corbris

# Installation
```
git clone https://github.com/poma/PoeHorticraftingScanner
npm install
```

Open the config.json file and enter your poe accountName and your POESESSID.
Your POESESSID is a cookie used to login to https://www.pathofexile.com. Find it by using your browsers dev tools and locating it under cookies.

To generate short output to use for discord run:
```shell script
npm run short
```
If you want you can output this into a file with 

```shell script
npm run short > output.txt
```

To generate a full list of crafts run:

```shell script
npm run full
```

# Config
`hideCategories`: Categories that you don't want to show in the discord formatted output, for example ["Randomise", "Other"]

`hideLevelUnder`: hide all crafts that are under this ilevel
