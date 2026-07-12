# SiteGrab

An automated site data pipeline, from an area name to a working model

SiteGrab exists because I got tired of the first hour of every project being spent hunting down and rebuilding basic site geometry by hand. It takes a single input, the name of an area, and returns either a Rhino model or a fully layered CAD file ready to work with.

Under the surface, it geocodes the area name to a bounding box, automatically detects the correct UTM projection for that location, and pulls building footprints, roads, and water bodies from OpenStreetMap, with retry logic and mirror failover built in so a single data source failing does not break the pipeline. From there it builds either a 2D DXF with granular, named layers, or a 3D Rhino .3dm model with buildings extruded as solid massing, roads raised as polylines, and water left as flat curves.

The backend runs as a FastAPI service in Docker, deployed and accessible without any local setup.

SiteGrab is the clearest evidence of the other half of how I work. The architecture projects show how I think about space, material, and atmosphere. This shows that I do not just use the tools a studio hands me, I build the ones that make the work faster and more precise when the existing ones fall short.
