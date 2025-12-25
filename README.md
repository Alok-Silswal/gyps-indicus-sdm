# Species Distribution Modeling (SDM) – Gyps indicus

This repository contains an end-to-end **presence-only Species Distribution Modeling (SDM)** pipeline for *Gyps indicus*, combining **Google Earth Engine (GEE)** for spatial data engineering with **Kernel Density Estimation (KDE)**–based modeling in Python to estimate **relative habitat suitability**.

## Project Overview
- Objective: Model and map relative habitat suitability using presence-only occurrence data.
- Approach: Learn the species’ environmental niche via KDE and project predictions back into geographic space.
- Output: Continuous habitat suitability maps and occurrence density visualizations.

## Workflow
1. **Google Earth Engine (GEE)**
   - Study area definition and occurrence point processing  
   - Environmental raster extraction (WorldClim climate variables, SRTM elevation)  
   - Background point sampling  
   - Rasterization, reprojection, and spatial smoothing  
   - Map-based visualization and exports  

2. **Python (Notebook)**
   - Feature preprocessing (scaling, transformation)  
   - KDE modeling in environmental space  
   - Evaluation using AUC (presence vs background)  
   - Export of predicted suitability for spatial mapping in GEE  

## Data
- `gyps_indicus_data.csv`: Presence-only occurrence records used for spatial processing and environmental sampling.
- `combined_with_final_suit.csv`: Occurance + Background points with KDE-based habitat suitability scores computed in Python and imported into GEE.
- `0022518-251009101135966.csv`: Raw occurrence data source retained for traceability.

## Evaluation
- Metric: AUC (presence vs background)
- Final AUC: **0.8664**

## Repository Structure

```
gyps-indicus-sdm/
│
├── README.md
├── sdm_kde_pipeline.ipynb
├── gyps_indicus_gee.js
├── .gitignore
└── assets/
    ├── gyps_indicus_data.csv
    ├── combined_with_final_suit.csv
    └── 0022518-251009101135966.csv

```

## Tech Stack
Python, Google Earth Engine, scikit-learn, Pandas, NumPy, Matplotlib

## Notes
- This project does **not** use true absence data.
- Suitability scores represent **relative ranking**, not probability of presence.
- Machine learning is performed in Python; GEE is used exclusively for spatial processing and mapping.
