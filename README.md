# Polyscope Ubuntu 16.4 LTS Containerised server

## Installation
##docker installation and added clean stuck jobs

1. Install Docker. 
2. Clone repository to local. 
3. Build the container: `docker build <path_to_repository> -t polyscope-server`. 


## Running using the Docker image created by Dockerfile:

Run with a local folder mapped to a volume containing the polyzoomer images which should be a *large volume outside of the Container*.

docker run -d -p 80:80 -p 3306:3306 -v "/Users/username/polyscope_data/polyzoomer:/var/www/html/polyzoomer" -v "/Users/username/polyscope_data/customers:/var/www/customers" -v "/media:/media" polyscope-server

Polyzoomer images for analysis should be in the mapped /polyzoomer folder.
