export interface GameItem {
  id: string;
  title: string;
  url: string;
  category: string;
  color: string;
  icon?: string;
  isNew?: boolean;
  frameColor?: string;
  badge?: string;
}

export const GAMES: GameItem[] = [
  {
    id: 'skribbl-io',
    title: 'skribbl.io',
    url: 'https://skribbl.io/',
    category: 'Multiplayer',
    color: 'blue',
    icon: 'https://skribbl.io/img/thumbnail.png',
    isNew: true,
    frameColor: 'yellow',
    badge: 'New!!'
  },
  { 
    id: 'gta-5-6', 
    title: 'GTA V|VI', 
    // Saved HTTPS link kept for later reference (not launched via iframe/redirect):
    url: 'https://gta5-87g.pages.dev/?low=1&fps=30&res=1280x720', 
    category: 'Action', 
    color: 'yellow', 
    icon: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3240220/header.jpg',
    isNew: true,
    frameColor: 'yellow',
    badge: 'Notice'
  },
  {
    id: 'magic-tiles-3',
    title: 'Magic Tiles 3',
    url: 'Games/Magic Tiles 3.html',
    category: 'Rhythm',
    color: 'cyan',
    icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/21/09/85/2109855a-4b74-8685-6801-b0b2c3756364/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg',
    isNew: true,
    frameColor: 'yellow',
    badge: 'New!!'
  },
  {
    id: 'retro-bowl-college',
    title: 'Retro Bowl College',
    url: 'Games/Retro Bowl College.html',
    category: 'Sports',
    color: 'amber',
    icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/15/6d/57/156d5757-df57-1b9b-1bbe-ae73bb98c3f9/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg',
    isNew: true,
    frameColor: 'yellow',
    badge: 'New!!'
  },
  {
    id: 'supreme-duelist',
    title: 'Supreme Duelist',
    url: 'Games/Supreme Duelist.html',
    category: 'Fighting',
    color: 'red',
    icon: 'https://play-lh.googleusercontent.com/aRfxVr9n8h6eXef11qHSUg63oALiL3sGflsCw9x831FhQwkC3jD2sO3boexMjcopkgqD8WG6jITiR0A9KMo2=w512-h512',
    isNew: true,
    frameColor: 'yellow',
    badge: 'New!!'
  },
  { id: 'fnf-sonic-exe', title: 'FNF Vs. Sonic.EXE 3.0/4.0', url: 'Games/FNF Vs. Sonic.EXE 3.0_4.0.html', category: 'Rhythm', color: 'indigo', icon: 'https://images.gamebanana.com/img/ss/mods/530-90_619fc02aef0d4.jpg' },
  { id: '2048-merge', title: '2048 Merge Run', url: 'Games/2048 Merge Run.html', category: 'Puzzle', color: 'orange', icon: 'https://play-lh.googleusercontent.com/qU8rxJl6tyioeFKqbdym2B4SpHAOOJtN81Bz6OC8TEII6tvRjTH4A_HYM1EFNF-JL8iZDfm9dZfQiLoLLFOOfQ=w512-h512' },
  { id: 'adofai', title: 'A Dance of Fire and Ice', url: 'Games/A Dance of Fire and Ice.html', category: 'Rhythm', color: 'red', icon: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/977950/header.jpg' },
  { id: 'adventure-cap', title: 'Adventure Capatalist', url: 'Games/Adventure Capatalist.html', category: 'Idle', color: 'green', icon: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/346900/header.jpg' },
  { id: 'ages-conflict', title: 'Ages of Conflict', url: 'Games/Ages of Conflict.html', category: 'Strategy', color: 'blue', icon: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2186320/header.jpg' },
  { id: 'amanda', title: 'Amanda the Adventurer', url: 'Games/Amanda the Adventurer.html', category: 'Horror', color: 'purple', icon: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2166060/header.jpg' },
  { id: 'basket-bros', title: 'Basket Bros', url: 'Games/Basket Bros.html', category: 'Sports', color: 'orange', icon: 'https://imgs.crazygames.com/basketbros_16x9/20251107022434/basketbros_16x9-cover?metadata=none&quality=100&width=1200&height=630&fit=crop&resizer=covers' },
  { id: 'basket-random', title: 'Basket Random', url: 'Games/Basket Random.html', category: 'Sports', color: 'amber', icon: 'https://imgs.crazygames.com/basket-random_16x9/20240617090207/basket-random_16x9-cover?metadata=none&quality=100&width=1200&height=630&fit=crop&resizer=covers' },
  { id: 'basketball-frvr', title: 'Basketball Frvr', url: 'Games/Basketball Frvr.html', category: 'Sports', color: 'orange', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/ee/59/d4/ee59d4ba-20bc-f6f9-a65c-f735e3d4307f/AppIcon-0-0-1x_U007emarketing-0-8-0-0-85-220.png/512x512bb.jpg' },
  { id: 'basketball-stars', title: 'Basketball Stars', url: 'Games/Basketball Stars.html', category: 'Sports', color: 'blue', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/f7/03/06/f7030690-e671-b3e7-8f9c-29ddf3bed595/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg' },
  { id: 'bitlife', title: 'BitLife', url: 'Games/BitLife.html', category: 'Life Sim', color: 'red', icon: 'https://play-lh.googleusercontent.com/OVgQx7M6lk9VcFZKIY_80siUOESLsu5gtwAKrjIruM097U-at161KrQ6Svxw3uPhY4EfKTGNrlpsd12k4TV6HA=w512-h512' },
  { id: 'bowmasters', title: 'Bowmasters', url: 'Games/Bowmasters.html', category: 'Action', color: 'pink', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/37/80/f7/3780f770-93fa-46de-ea37-b6d0f66d2c63/AppIcon-1x_U007emarketing-0-8-0-85-220-0.png/512x512bb.jpg' },
  { id: 'buildnow', title: 'BuildNow.gg', url: 'Games/BuildNow.gg.html', category: 'Shooter', color: 'indigo', icon: 'https://imgs.crazygames.com/buildnow-gg_16x9/20251229084241/buildnow-gg_16x9-cover?metadata=none&quality=100&width=1200&height=630&fit=crop&resizer=covers' },
  { id: 'car-survival', title: 'Car Survival 3D', url: 'Games/Car Survival 3D.html', category: 'Racing', color: 'zinc', icon: 'https://play-lh.googleusercontent.com/UUJUIfE4roAByhECsof8WC3DR0uUe00-xOljCAXKZ8cZb1huHq7F61pr-Fs88sqrMfMKNV_3SUvh6D8KT42Y=w512-h512' },
  { id: 'city-defense', title: 'City Defense', url: 'Games/City Defense.html', category: 'Strategy', color: 'blue', icon: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/997870/header.jpg' },
  { id: 'city-smash', title: 'City Smash', url: 'Games/City Smash.html', category: 'Action', color: 'red', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/a3/17/56/a3175662-9aa5-4f87-a76c-d74fd5d619fe/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg' },
  { id: 'cluster-rush', title: 'Cluster Rush', url: 'Games/Cluster Rush.html', category: 'Action', color: 'yellow', icon: 'https://play-lh.googleusercontent.com/yp84A3FUkySGBCyY4TjTUt9bZGVi9weQD3ULlIJ5_xOZeJEb4bAx4DQNdT2o4xv5aGO6nGAnWhAY69Bynxn8=w512-h512' },
  { id: 'clustertruck', title: 'ClusterTruck', url: 'Games/ClusterTruck.html', category: 'Action', color: 'orange', icon: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/397950/header.jpg' },
  { id: 'cookie-clicker', title: 'Cookie Clicker', url: 'Games/Cookie Clicker.html', category: 'Idle', color: 'brown', icon: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1454400/header.jpg' },
  { id: 'drift-boss', title: 'Drift Boss', url: 'Games/Drift Boss.html', category: 'Racing', color: 'purple', icon: 'https://imgs.crazygames.com/drift-boss_16x9/20260209092420/drift-boss_16x9-cover?metadata=none&quality=100&width=1200&height=630&fit=crop&resizer=covers' },
  { id: 'drift-hunters', title: 'Drift Hunters', url: 'Games/Drift Hunters.html', category: 'Racing', color: 'blue', icon: 'https://imgs.crazygames.com/games/drift-hunters/cover-1656950639575.png?metadata=none&quality=100&width=1200&height=630&fit=crop&resizer=covers' },
  { id: 'fnaf2', title: 'Five Nights at Freddy\'s 2', url: 'Games/Five Nights at Freddy\'s 2.html', category: 'Horror', color: 'red', icon: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/332800/header.jpg' },
  { id: 'fnaf3', title: 'Five Nights at Freddy\'s 3', url: 'Games/Five Nights at Freddy\'s 3.html', category: 'Horror', color: 'green', icon: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/354140/header.jpg' },
  { id: 'fnaf4', title: 'Five Nights at Freddy\'s 4', url: 'Games/Five Nights at Freddy\'s 4.html', category: 'Horror', color: 'purple', icon: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/388090/header.jpg' },
  { id: 'fnf-garcello', title: 'Friday Night Funkin vs. Garcello', url: "Games/Friday Night Funkin'_ vs. Garcello.html", category: 'Rhythm', color: 'emerald', icon: 'https://images.gamebanana.com/img/ss/mods/530-90_608f014c1c991.jpg' },
  { id: 'fnf-tricky', title: 'Friday Night Funkin vs. Tricky', url: "Games/Friday Night Funkin'_ vs. Tricky.html", category: 'Rhythm', color: 'red', icon: 'https://images.gamebanana.com/img/ss/mods/530-90_66416344151d5.jpg' },
  { id: 'fnf', title: 'Friday Night Funkin', url: 'Games/Friday Night Funkin.html', category: 'Rhythm', color: 'pink', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/0e/b2/21/0eb22146-f8be-720c-bd84-714cb2f3d410/AppIcon-0-0-1x_U007emarketing-0-11-0-P3-85-220.png/512x512bb.jpg' },
  { id: 'fruit-ninja', title: 'Fruit Ninja', url: 'Games/Fruit Ninja.html', category: 'Action', color: 'green', icon: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/486780/header.jpg' },
  { id: 'geometry-dash', title: 'Geometry Dash', url: 'Games/Geometry Dash.html', category: 'Rhythm', color: 'emerald', icon: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/322170/header.jpg' },
  { id: 'gladihoppers', title: 'Gladihoppers', url: 'Games/Gladihoppers.html', category: 'Action', color: 'brown', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple116/v4/02/15/d2/0215d21e-670f-2453-4884-997c6256c9c6/AppIcon-0-0-1x_U007emarketing-0-0-0-7-0-0-sRGB-0-0-0-GLES2_U002c0-512MB-85-220-0-0.png/512x512bb.jpg' },
  { id: 'gta3', title: 'Grand Theft Auto 3', url: 'Games/Grand Theft Auto 3.html', category: 'Open World', color: 'blue', icon: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1546970/header.jpg' },
  { id: 'granny2', title: 'Granny 2', url: 'Games/Granny 2.html', category: 'Horror', color: 'zinc', icon: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1205040/header.jpg' },
  { id: 'granny', title: 'Granny', url: 'Games/Granny.html', category: 'Horror', color: 'zinc', icon: 'https://play-lh.googleusercontent.com/P8BbkQ6m0eCYYAx2tXTESBiIDQ2RESsSQp6oD8ZAP35rmEjmaXHMboYT6P807sAnfcuskKTdYbTyH5R0GCFk8Q=w512-h512' },
  { id: 'happy-wheels', title: 'Happy Wheels', url: 'Games/Happy Wheels.html', category: 'Action', color: 'red', icon: 'https://play-lh.googleusercontent.com/1kcsMeVcPtBj6bV3wQWuLBcpfdWekxjMt3eXo5dRXr9NfEt2i5lIe-mKSLrPwyfTt40Fctysl-jZnZdsiB9CkQ=w512-h512' },
  { id: 'harvest-io', title: 'Harvest.io', url: 'Games/Harvest.io.html', category: 'IO Game', color: 'emerald', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/d9/61/97/d96197bb-5162-5f69-b270-a65909b02e23/AppIcon-1x_U007emarketing-0-8-0-85-220-0.png/512x512bb.jpg' },
  { id: 'hypper-sandbox', title: 'Hypper Sandbox', url: 'Games/Hypper Sandbox.html', category: 'Sandbox', color: 'blue', icon: 'https://play-lh.googleusercontent.com/3Gz5yuSNS3VNtIXIBhfCubqJVZY0yG9lwBe74EZQyHrWJi7xhy3leCPAShH_Zq8HjivT_R9ufBJAzp0clNMf=w512-h512' },
  { id: 'idle-mining', title: 'Idle Mining Empire', url: 'Games/Idle Mining Empire.html', category: 'Idle', color: 'yellow', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/f1/64/78/f16478d4-5688-e287-72b6-d9a0e601f2b0/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg' },
  { id: 'just-shapes', title: 'Just Shapes & Beats', url: 'Games/Just Shapes & Beats.html', category: 'Rhythm', color: 'pink', icon: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/531510/header.jpg' },
  { id: 'karlson', title: 'Karlson', url: 'Games/Karlson.html', category: 'Action', color: 'cyan', icon: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1228610/header.jpg' },
  { id: 'kindergarten', title: 'Kindergarten', url: 'Games/Kindergarten.html', category: 'Puzzle', color: 'yellow', icon: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/589590/header.jpg' },
  { id: 'melon-playground', title: 'Melon Playground', url: 'Games/Melon Playground.html', category: 'Sandbox', color: 'green', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/15/bb/f7/15bbf774-60a8-1647-ff65-628361330de8/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg' },
  { id: 'miside', title: 'MiSide', url: 'Games/MiSide.html', category: 'Simulation', color: 'purple', icon: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2527500/header.jpg' },
  { id: 'minecraft', title: 'Minecraft', url: 'Games/Minecraft Pocket Edition.html', category: 'Sandbox', color: 'green', icon: 'https://play-lh.googleusercontent.com/tI4StRSPVhpGJH5R013naszLUawOjao1ya8FvyaNO7XY_cJFHFqo1EFaEJv_7zz3rRJ5lEpLiw14ZqQLCOYc=w512-h512' },
  { id: 'moto-x3m', title: 'Moto X3M', url: 'Games/Moto X3M.html', category: 'Racing', color: 'orange', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/8a/51/52/8a5152b8-268d-2d08-896a-f4d054a98d55/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg' },
  { id: 'ace-attorney', title: 'Ace Attorney', url: 'Games/Phoenix Wright - Ace Attorney.html', category: 'Puzzle', color: 'blue', icon: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/787480/header.jpg' },
  { id: 'poly-track', title: 'Poly Track', url: 'Games/Poly Track.html', category: 'Racing', color: 'white', icon: 'https://www.kodub.com/apps/polytrack/image' },
  { id: 'ragdoll-archers', title: 'Ragdoll Archers', url: 'Games/Ragdoll Archers.html', category: 'Action', color: 'amber', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/de/b6/b4/deb6b455-2da8-97df-6453-1517a2334972/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg' },
  { id: 'retro-bowl', title: 'Retro Bowl', url: 'Games/Retro Bowl.html', category: 'Sports', color: 'brown', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/19/7d/d8/197dd8db-93d4-f20b-b99b-fd809f070698/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg' },
  { id: 'schoolboy-runaway', title: 'Schoolboy Runaway', url: 'Games/Schoolboy Runaway.html', category: 'Action', color: 'blue', icon: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3359320/header.jpg' },
  { id: 'solar-smash', title: 'Solar Smash', url: 'Games/SolarSmash.html', category: 'Planet Destroyer', color: 'pink', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/b2/a5/dc/b2a5dc6f-16ed-26f9-c28e-8a239604cd3d/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg' },
  { id: 'terraria', title: 'Terraria', url: 'Games/Terraria.html', category: 'Sandbox', color: 'green', icon: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/105600/header.jpg' },
  { id: 'tabs', title: 'TABS', url: 'Games/Totally Accurate Battle Simulator (TABS).html', category: 'Strategy', color: 'red', icon: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/508440/header.jpg' },
  { id: 'amaze', title: 'Amaze!', url: 'Games/Amaze.html', category: 'Puzzle', color: 'cyan', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/43/03/b5/4303b54d-ef47-d178-b093-758b31898bbf/AppIcon-1x_U007emarketing-0-8-0-85-220-0.png/512x512bb.jpg' },
  { id: 'angry-birds', title: 'Angry Birds', url: 'Games/Angry Birds.html', category: 'Action', color: 'red', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/36/db/1f/36db1ffb-5ec7-7d3f-b90c-f28c7d0d4f60/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg' },
  { id: 'aquapark-io', title: 'Aquapark.io', url: 'Games/Aquapark.io.html', category: 'Multiplayer', color: 'blue', icon: 'https://play-lh.googleusercontent.com/ec1DxHnYjZrCxdjfgd03YNsO_rl38ynpEKyuwIdDA2moHjH-jq5LSiO0eqpzClNdXkgDWPAiXYb9yelHUdOE=w512-h512' },
  { id: 'basket-battle', title: 'Basket Battle', url: 'Games/Basket Battle.html', category: 'Multiplayer', color: 'orange', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/6b/3c/a6/6b3ca6eb-c4aa-4d24-5c76-d1212cf9cc61/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg' },
  { id: 'brawl-simulator-3d', title: 'Brawl Simulator 3D', url: 'Games/Brawl Simulator 3D.html', category: 'Fighting', color: 'amber', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/b3/65/2d/b3652d49-c00c-7f1f-f63e-941eb32ffeef/AppIcon-0-0-1x_U007epad-0-1-85-220.png/512x512bb.jpg' },
  { id: 'build-a-big-army', title: 'Build a Big Army', url: 'Games/Build a Big Army.html', category: 'Building', color: 'indigo', icon: 'https://play-lh.googleusercontent.com/kKwDuf2qrGO-ErIHith1-OsbidPCiD-ztGq25Ovsgz5Fw4ee7rMFwK9nLTIz6xgv47Dfg1sH-vOSn3S92uCVIA=w512-h512' },
  { id: 'fnf-carol-v2', title: 'Friday Night Funkin vs Carol V2', url: 'Games/Friday Night Funkin vs Carol V2.html', category: 'Rhythm', color: 'pink', icon: 'https://images.gamebanana.com/img/ss/mods/530-90_60e99c25db96e.jpg' },
  { id: 'fnf-shaggy', title: 'Friday Night Funkin vs Shaggy', url: 'Games/Friday Night Funkin vs Shaggy.html', category: 'Rhythm', color: 'green', icon: 'https://images.gamebanana.com/img/ss/mods/530-90_6188971211d5c.jpg' },
  { id: 'fnf-sunday', title: 'Friday Night Funkin vs Sunday Remastered HD', url: 'Games/Friday Night Funkin vs Sunday Remastered HD.html', category: 'Rhythm', color: 'purple', icon: 'https://images.gamebanana.com/img/ss/mods/530-90_64a0f8e8d22a7.jpg' },
  { id: 'idle-lumber-inc', title: 'Idle Lumber Inc', url: 'Games/Idle Lumber Inc.html', category: 'Building', color: 'emerald', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/4f/b9/73/4fb9736b-6309-4032-5d2f-ca455a8b1fc2/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/512x512bb.jpg' },
];

export const APPS: GameItem[] = [
  { id: 'central-music', title: 'Central Music', url: 'Apps/CentralMusic.html', category: 'Music System', color: 'cyan', icon: 'https://play-lh.googleusercontent.com/MyptZXmcCyF59phIWPsNCfHq6zSO_ojEdw_4rMYYWPOGdikSjqeOXcoszBZ053VYpINe5K7ZR9KV1nkFWgxdOw=w512-h512' },
  { id: 'cinema', title: 'CinemaTok', url: 'Apps/Cinema.html', category: 'Global Stream', color: 'pink', icon: 'https://play-lh.googleusercontent.com/0Lfh7C0v8WC1mss1UrBpktHWR4LKMwF3UMFQnbQY_HctalXCsRSdQI7VcTnjGAQiyzAaYnhrMRqQvgNTZhhdXQ=w512-h512' },
  { id: 'snapchat', title: 'Snapchat', url: 'https://nhjkdbiondnnd.dila.cl/embed.html#https://snapchat.com/spotlight', category: 'Spotlight View', color: 'yellow', icon: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/0d/c5/ea/0dc5ea9e-b58d-c58a-0f13-da932bf7cbb5/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/512x512bb.jpg' },
];
