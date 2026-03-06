#!/bin/bash

# Author: Sebastian Schmittner
# Date: 2014.07.23
# LastAuthor: Sebastian Schmittner
# LastDate: 2015.01.13 21:27:07 (+01:00)
# Version: 0.1.0

echo "Updating installation"
sudo ~/productionPolyscope/update_server.sh

echo "Adjust privileges"
sudo chown -R www-data:www-data ./*

echo "Remove eol inconsistencies"
sudo ./cleanDOS.sh
