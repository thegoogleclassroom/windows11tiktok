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
    id: 'gta-5-6', 
    title: 'GTA 5/6', 
    url: 'https://gta5-87g.pages.dev/?low=1&fps=30&res=1280x720', 
    category: 'Action', 
    color: 'yellow', 
    icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/gta_v.svg',
    isNew: true,
    frameColor: 'yellow',
    badge: 'New!!'
  },
  { id: '2048-merge', title: '2048 Merge Run', url: 'Games/2048 Merge Run.html', category: 'Puzzle', color: 'orange', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/merge_master.svg' },
  { id: 'adofai', title: 'A Dance of Fire and Ice', url: 'Games/A Dance of Fire and Ice.html', category: 'Rhythm', color: 'red', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/dance_of_fire_and_ice.svg' },
  { id: 'adventure-cap', title: 'Adventure Capatalist', url: 'Games/Adventure Capatalist.html', category: 'Idle', color: 'green', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/adventure_capitalist.svg' },
  { id: 'ages-conflict', title: 'Ages of Conflict', url: 'Games/Ages of Conflict.html', category: 'Strategy', color: 'blue', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/world_conqueror.svg' },
  { id: 'amanda', title: 'Amanda the Adventurer', url: 'Games/Amanda the Adventurer.html', category: 'Horror', color: 'purple', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/amanda_the_adventurer.svg' },
  { id: 'basket-bros', title: 'Basket Bros', url: 'Games/Basket Bros.html', category: 'Sports', color: 'orange', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/basketball.svg' },
  { id: 'basket-random', title: 'Basket Random', url: 'Games/Basket Random.html', category: 'Sports', color: 'amber', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/basketball_stars.svg' },
  { id: 'basketball-frvr', title: 'Basketball Frvr', url: 'Games/Basketball Frvr.html', category: 'Sports', color: 'orange', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/basketball.svg' },
  { id: 'basketball-stars', title: 'Basketball Stars', url: 'Games/Basketball Stars.html', category: 'Sports', color: 'blue', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/basketball_stars.svg' },
  { id: 'bitlife', title: 'BitLife', url: 'Games/BitLife.html', category: 'Life Sim', color: 'red', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/bitlife.svg' },
  { id: 'bowmasters', title: 'Bowmasters', url: 'Games/Bowmasters.html', category: 'Action', color: 'pink', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/bowmasters.svg' },
  { id: 'buildnow', title: 'BuildNow.gg', url: 'Games/BuildNow.gg.html', category: 'Shooter', color: 'indigo', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/fortnite.svg' },
  { id: 'car-survival', title: 'Car Survival 3D', url: 'Games/Car Survival 3D.html', category: 'Racing', color: 'zinc', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/car_parking.svg' },
  { id: 'city-defense', title: 'City Defense', url: 'Games/City Defense.html', category: 'Strategy', color: 'blue', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/clash_of_clans.svg' },
  { id: 'city-smash', title: 'City Smash', url: 'Games/City Smash.html', category: 'Action', color: 'red', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/solar_smash.svg' },
  { id: 'cluster-rush', title: 'Cluster Rush', url: 'Games/Cluster Rush.html', category: 'Action', color: 'yellow', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/parkour.svg' },
  { id: 'clustertruck', title: 'ClusterTruck', url: 'Games/ClusterTruck.html', category: 'Action', color: 'orange', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/truck_driver.svg' },
  { id: 'cookie-clicker', title: 'Cookie Clicker', url: 'Games/Cookie Clicker.html', category: 'Idle', color: 'brown', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/cookie_clicker.svg' },
  { id: 'drift-boss', title: 'Drift Boss', url: 'Games/Drift Boss.html', category: 'Racing', color: 'purple', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/drift_max.svg' },
  { id: 'drift-hunters', title: 'Drift Hunters', url: 'Games/Drift Hunters.html', category: 'Racing', color: 'blue', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/drift_max.svg' },
  { id: 'fnaf2', title: 'Five Nights at Freddy\'s 2', url: 'Games/Five Nights at Freddy\'s 2.html', category: 'Horror', color: 'red', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/fnaf.svg' },
  { id: 'fnaf3', title: 'Five Nights at Freddy\'s 3', url: 'Games/Five Nights at Freddy\'s 3.html', category: 'Horror', color: 'green', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/fnaf.svg' },
  { id: 'fnaf4', title: 'Five Nights at Freddy\'s 4', url: 'Games/Five Nights at Freddy\'s 4.html', category: 'Horror', color: 'purple', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/fnaf.svg' },
  { id: 'fnf-garcello', title: 'Friday Night Funkin vs. Garcello', url: "Games/Friday Night Funkin'_ vs. Garcello.html", category: 'Rhythm', color: 'emerald', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/fnf.svg' },
  { id: 'fnf-tricky', title: 'Friday Night Funkin vs. Tricky', url: "Games/Friday Night Funkin'_ vs. Tricky.html", category: 'Rhythm', color: 'red', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/fnf.svg' },
  { id: 'fnf', title: 'Friday Night Funkin', url: 'Games/Friday Night Funkin.html', category: 'Rhythm', color: 'pink', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/fnf.svg' },
  { id: 'fruit-ninja', title: 'Fruit Ninja', url: 'Games/Fruit Ninja.html', category: 'Action', color: 'green', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/fruit_ninja.svg' },
  { id: 'geometry-dash', title: 'Geometry Dash', url: 'Games/Geometry Dash.html', category: 'Rhythm', color: 'emerald', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/geometry_dash.svg' },
  { id: 'gladihoppers', title: 'Gladihoppers', url: 'Games/Gladihoppers.html', category: 'Action', color: 'brown', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/gladiator.svg' },
  { id: 'gta3', title: 'Grand Theft Auto 3', url: 'Games/Grand Theft Auto 3.html', category: 'Open World', color: 'blue', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/gta_v.svg' },
  { id: 'granny2', title: 'Granny 2', url: 'Games/Granny 2.html', category: 'Horror', color: 'zinc', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/granny.svg' },
  { id: 'granny', title: 'Granny', url: 'Games/Granny.html', category: 'Horror', color: 'zinc', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/granny.svg' },
  { id: 'happy-wheels', title: 'Happy Wheels', url: 'Games/Happy Wheels.html', category: 'Action', color: 'red', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/happy_wheels.svg' },
  { id: 'harvest-io', title: 'Harvest.io', url: 'Games/Harvest.io.html', category: 'IO Game', color: 'emerald', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/harvest_io.svg' },
  { id: 'hypper-sandbox', title: 'Hypper Sandbox', url: 'Games/Hypper Sandbox.html', category: 'Sandbox', color: 'blue', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/sandbox.svg' },
  { id: 'idle-mining', title: 'Idle Mining Empire', url: 'Games/Idle Mining Empire.html', category: 'Idle', color: 'yellow', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/idle_miner.svg' },
  { id: 'just-shapes', title: 'Just Shapes & Beats', url: 'Games/Just Shapes & Beats.html', category: 'Rhythm', color: 'pink', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/just_shapes_and_beats.svg' },
  { id: 'karlson', title: 'Karlson', url: 'Games/Karlson.html', category: 'Action', color: 'cyan', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/superhot.svg' },
  { id: 'kindergarten', title: 'Kindergarten', url: 'Games/Kindergarten.html', category: 'Puzzle', color: 'yellow', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/kindergarten.svg' },
  { id: 'melon-playground', title: 'Melon Playground', url: 'Games/Melon Playground.html', category: 'Sandbox', color: 'green', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/melon_playground.svg' },
  { id: 'miside', title: 'MiSide', url: 'Games/MiSide.html', category: 'Simulation', color: 'purple', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/miside.svg' },
  { id: 'minecraft', title: 'Minecraft', url: 'Games/Minecraft Pocket Edition.html', category: 'Sandbox', color: 'green', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/minecraft.svg' },
  { id: 'moto-x3m', title: 'Moto X3M', url: 'Games/Moto X3M.html', category: 'Racing', color: 'orange', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/moto_x3m.svg' },
  { id: 'ace-attorney', title: 'Ace Attorney', url: 'Games/Phoenix Wright - Ace Attorney.html', category: 'Puzzle', color: 'blue', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/ace_attorney.svg' },
  { id: 'poly-track', title: 'Poly Track', url: 'Games/Poly Track.html', category: 'Racing', color: 'white', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/polytrack.svg' },
  { id: 'ragdoll-archers', title: 'Ragdoll Archers', url: 'Games/Ragdoll Archers.html', category: 'Action', color: 'amber', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/archery.svg' },
  { id: 'retro-bowl', title: 'Retro Bowl', url: 'Games/Retro Bowl.html', category: 'Sports', color: 'brown', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/retro_bowl.svg' },
  { id: 'schoolboy-runaway', title: 'Schoolboy Runaway', url: 'Games/Schoolboy Runaway.html', category: 'Action', color: 'blue', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/school_boy.svg' },
  { id: 'solar-smash', title: 'Solar Smash', url: 'Games/SolarSmash.html', category: 'Planet Destroyer', color: 'pink', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/solar_smash.svg' },
  { id: 'terraria', title: 'Terraria', url: 'Games/Terraria.html', category: 'Sandbox', color: 'green', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/terraria.svg' },
  { id: 'tabs', title: 'TABS', url: 'Games/Totally Accurate Battle Simulator (TABS).html', category: 'Strategy', color: 'red', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/tabs.svg' },
  { id: 'amaze', title: 'Amaze!', url: 'Games/Amaze.html', category: 'Puzzle', color: 'cyan', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/maze.svg' },
  { id: 'angry-birds', title: 'Angry Birds', url: 'Games/Angry Birds.html', category: 'Action', color: 'red', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/angry_birds.svg' },
  { id: 'aquapark-io', title: 'Aquapark.io', url: 'Games/Aquapark.io.html', category: 'Multiplayer', color: 'blue', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/water_park.svg' },
  { id: 'basket-battle', title: 'Basket Battle', url: 'Games/Basket Battle.html', category: 'Multiplayer', color: 'orange', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/basketball.svg' },
  { id: 'brawl-simulator-3d', title: 'Brawl Simulator 3D', url: 'Games/Brawl Simulator 3D.html', category: 'Fighting', color: 'amber', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/brawl_stars.svg' },
  { id: 'build-a-big-army', title: 'Build a Big Army', url: 'Games/Build a Big Army.html', category: 'Building', color: 'indigo', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/army.svg' },
  { id: 'fnf-carol-v2', title: 'Friday Night Funkin vs Carol V2', url: 'Games/Friday Night Funkin vs Carol V2.html', category: 'Rhythm', color: 'pink', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/fnf.svg' },
  { id: 'fnf-shaggy', title: 'Friday Night Funkin vs Shaggy', url: 'Games/Friday Night Funkin vs Shaggy.html', category: 'Rhythm', color: 'green', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/fnf.svg' },
  { id: 'fnf-sunday', title: 'Friday Night Funkin vs Sunday Remastered HD', url: 'Games/Friday Night Funkin vs Sunday Remastered HD.html', category: 'Rhythm', color: 'purple', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/fnf.svg' },
  { id: 'idle-lumber-inc', title: 'Idle Lumber Inc', url: 'Games/Idle Lumber Inc.html', category: 'Building', color: 'emerald', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/lumber.svg' },
];

export const APPS: GameItem[] = [
  { id: 'central-music', title: 'Central Music', url: 'Apps/CentralMusic.html', category: 'Music System', color: 'cyan', icon: 'https://cdn.jsdelivr.net/gh/Arcticons-Team/Arcticons/icons/black/spotify.svg' },
  { id: 'cinema', title: 'CinemaTok', url: 'Apps/Cinema.html', category: 'Global Stream', color: 'pink' },
  { id: 'snapchat', title: 'Snapchat', url: 'https://nhjkdbiondnnd.dila.cl/embed.html#https://snapchat.com/spotlight', category: 'Spotlight View', color: 'yellow' },
];
