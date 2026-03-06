#!/bin/bash

# Author: Sebastian Schmittner (stp.schmittner@gmail.com)
# Date: 2015.01.31
# LastAuthor: Sebastian Schmittner
# LastDate: 2015.02.19 09:46:03 (+01:00)
# Version: 0.0.1

# create lock
lockfile -r 0 /tmp/polyzoomerSupervisor.lock || exit 1

# execute the supervisor
php ./executeSupervisor.php

# remove the lock
rm -f /tmp/polyzoomerSupervisor.lock
