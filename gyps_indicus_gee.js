// ==============================================================================================

//              Species Distribution Modeling (SDM) – Gyps indicus
//       Purpose: Spatial preprocessing, visualization, and raster mapping
//          Note: Machine learning (KDE) is performed externally in Python

// =============================================================================================

// Files Required:
// 1. projects/evssem3/assets/gyps_indicus_data (occurrence data)
// 2. projects/evssem3/assets/combined_with_final_suit (pre-computed suitability from python - 77k points)

// Datasets Used:
// 3. FAO/GAUL/2015/level1 (Earth Engine public dataset)
// 4. WORLDCLIM/V1/BIO (Earth Engine public dataset)
// 5. CGIAR/SRTM90_V4 (Earth Engine public dataset)

// ==============================================================================================

// =================================================================
// 1. STUDY AREA DEFINITION
// =================================================================

var india = ee.FeatureCollection("FAO/GAUL/2015/level1")
              .filter(ee.Filter.eq('ADM0_NAME', 'India'));

var studyArea = india.filter(ee.Filter.inList('ADM1_NAME', [
  'Gujarat',
  'Rajasthan',
  'Madhya Pradesh'
]));

print('Study Area:', studyArea);
Map.centerObject(studyArea, 6);

// =================================================================
// 2. LOAD AND PROCESS OCCURRENCE DATA
// =================================================================

var occData = ee.FeatureCollection('projects/evssem3/assets/gyps_indicus_data');

var occPoints = occData.map(function(f) {
  var lon = ee.Number.parse(f.get('decimalLongitude'));
  var lat = ee.Number.parse(f.get('decimalLatitude'));
  return ee.Feature(ee.Geometry.Point([lon, lat]), f.toDictionary());
});

var occInRegion = occPoints.filterBounds(studyArea);

print('Total occurrence points:', occPoints.size());
print('Points within study area:', occInRegion.size());

// =================================================================
// 3. LOAD ENVIRONMENTAL LAYERS
// =================================================================

var bio = ee.Image("WORLDCLIM/V1/BIO").clip(studyArea);
var elev = ee.Image("CGIAR/SRTM90_V4").clip(studyArea);
var envStack = bio.select(['bio01', 'bio12']).addBands(elev.rename('elevation'));

print('WorldClim projection:', bio.projection());
print('WorldClim nominal scale (m):', bio.projection().nominalScale());


print('Environmental Stack (bio01, bio12, elevation):', envStack);

//3.1 Inspect value ranges (for visualization sanity checks in section 7.2)

var bio01Stats = bio.select('bio01').reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: studyArea,
  scale: 1000,
  maxPixels: 1e13
});

print('BIO1 min/max:', bio01Stats);

var bio12Stats = bio.select('bio12').reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: studyArea,
  scale: 1000,
  maxPixels: 1e13
});

print('BIO12 min/max:', bio12Stats);

var elevStats = elev.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: studyArea,
  scale: 1000,
  maxPixels: 1e13
});

print('Elevation min/max:', elevStats);

// =================================================================
// 4. OCCURRENCE DENSITY HEATMAP
// =================================================================

var occHeatmap = occInRegion
  .reduceToImage({
    properties: ['gbifID'],
    reducer: ee.Reducer.count()
  })
  .convolve(ee.Kernel.gaussian({
    radius: 30000,
    sigma: 15000,
    units: 'meters',
    normalize: true
  }))
  .multiply(800)
  .clip(studyArea);

// =================================================================
// 5. SAMPLE ENVIRONMENTAL DATA FOR ML TRAINING
// =================================================================

// Sample environmental values at occurrence points
var occEnvSample = envStack.sampleRegions({
  collection: occInRegion,
  properties: [],
  scale: 1000,
  geometries: true
});

print('Sampled occurrence points with environment:', occEnvSample.limit(10));

// Generate exactly 77,000 background points
var nBackground = 77000;
print('Generating background points:', nBackground);

var backgroundPoints = ee.FeatureCollection.randomPoints({
  region: studyArea.geometry(),
  points: nBackground,
  seed: 42
});

// Sample environmental layers at background points
var backgroundEnvSample = envStack.sampleRegions({
  collection: backgroundPoints,
  properties: [],
  scale: 1000,
  geometries: true
});

print('Background points sampled:', backgroundEnvSample.size());

// =================================================================
// 6. HABITAT SUITABILITY HEATMAP (FROM PRE-COMPUTED SCORES)
// =================================================================

// Load suitability data with scores from your ML model
// This FeatureCollection already has Point geometry - no need to parse coordinates
var suitPoints = ee.FeatureCollection('projects/evssem3/assets/combined_with_final_suit');

print('Suitability points loaded:', suitPoints.size());

var stats = suitPoints.aggregate_stats('suit_final_norm');
print('Suitability range:', stats);

// Create smoothed continuous heatmap
var suitabilityRaster = suitPoints.reduceToImage({
  properties: ['suit_final_norm'],
  reducer: ee.Reducer.mean()
}).reproject('EPSG:4326', null, 10000)
  .focal_mean({radius: 100000, kernelType: 'gaussian', units: 'meters'})
  .focal_mean({radius: 75000, kernelType: 'gaussian', units: 'meters'})
  .focal_mean({radius: 50000, kernelType: 'gaussian', units: 'meters'})
  .focal_mean({radius: 25000, kernelType: 'gaussian', units: 'meters'})
  .clip(studyArea);

print('Habitat Suitability Raster created');

// =================================================================
// 7. VISUALIZATION
// =================================================================

// 7.1. Study area boundary
Map.addLayer(
  studyArea.style({
    color: 'black',
    fillColor: '00000000',
    width: 2
  }),
  {},
  'Study Area Boundary'
);

// 7.2. Environmental layers (off by default)
Map.addLayer(
  bio.select('bio01'), 
  {min: 182, max: 280, palette: ['blue', 'yellow', 'red']}, 
  'Temperature (BIO1)',
  false
);

Map.addLayer(
  bio.select('bio12'), 
  {min: 95, max: 2719, palette: ['white', 'blue', 'darkblue']}, 
  'Precipitation (BIO12)',
  false
);

Map.addLayer(
  elev, 
  {min: -3, max: 1581, palette: ['white', 'brown']}, 
  'Elevation',
  false
);

// 7.3. Background points (off by default)
Map.addLayer(
  backgroundPoints.limit(5000), 
  {color: 'blue'}, 
  'Background Points',
  false
);

// 7.4. Occurrence density heatmap (off by default)
Map.addLayer(
  occHeatmap,
  {
    min: 0,
    max: 200,
    palette: ['lightyellow', 'orange', 'red', 'darkred', 'black'],
    opacity: 0.85
  },
  'Occurrence Density Heatmap',
  false
);

// 7.5. Habitat suitability heatmap
Map.addLayer(
  suitabilityRaster,
  {
    min: 0.05,
    max: 1,
    palette: ['000004', '320A5A', '781B6C', 'ED6925', 'FDE725']
  },
  'Habitat Suitability'
);

// 7.6. All occurrence points (off by default)
Map.addLayer(
  occPoints.style({
    color: 'red',
    pointSize: 3,
    width: 0.5
  }),
  {},
  'All Occurrences',
  false
);

// 7.7. Occurrences inside study area (on top) (off by default)
Map.addLayer(
  occInRegion.style({
    color: 'yellow',
    pointSize: 4,
    width: 1,
    fillColor: 'orange'
  }),
  {},
  'Occurrences in Study Area',
  false
);

// =================================================================
// 8. EXPORTS (Uncomment to use)
// =================================================================

// Export occurrence samples with environmental data
/*
Export.table.toDrive({
  collection: occEnvSample,
  description: 'Occurrence_Env_Samples',
  fileFormat: 'CSV',
  folder: 'GEE_exports'
});
*/

// Export 77k background samples with environmental data
/*
Export.table.toDrive({
  collection: backgroundEnvSample,
  description: 'Background_Env_Samples_77k',
  fileFormat: 'CSV',
  folder: 'GEE_exports'
});
*/

// Export occurrence data
/*
Export.table.toDrive({
  collection: occInRegion,
  description: 'Gyps_indicus_Occurrences',
  fileFormat: 'CSV',
  folder: 'GEE_exports'
});
*/

// Export study area boundary
/*
Export.table.toDrive({
  collection: studyArea,
  description: 'StudyArea_Boundary',
  fileFormat: 'SHP',
  folder: 'GEE_exports'
});
*/

// Export environmental variables
/*
Export.image.toDrive({
  image: bio.clip(studyArea),
  description: 'WorldClim_Bioclim',
  region: studyArea.geometry(),
  scale: 1000,
  fileFormat: 'GeoTIFF',
  folder: 'GEE_exports',
  maxPixels: 1e13
});

Export.image.toDrive({
  image: elev,
  description: 'Elevation_SRTM',
  region: studyArea.geometry(),
  scale: 1000,
  fileFormat: 'GeoTIFF',
  folder: 'GEE_exports'
});
*/

// Export occurrence heatmap
/*
Export.image.toDrive({
  image: occHeatmap,
  description: 'Occurrence_Heatmap',
  region: studyArea.geometry(),
  scale: 1000,
  fileFormat: 'GeoTIFF',
  folder: 'GEE_exports'
});
*/

// Export habitat suitability raster
/*
Export.image.toDrive({
  image: suitabilityRaster,
  description: 'Habitat_Suitability',
  scale: 1000,
  region: studyArea.geometry(),
  maxPixels: 1e9,
  fileFormat: 'GeoTIFF',
  folder: 'GEE_exports'
});
*/

print('=== SCRIPT COMPLETE ===');
print('Study area bounds:', studyArea.geometry().bounds());