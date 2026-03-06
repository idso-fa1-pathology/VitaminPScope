# Polyscope Server Docker container
#
# By Dr. Jamie Alnasir, Scientific Computing
#
# Adapted from Ubuntu-LAMP stack docker container:
# https://github.com/fauria/docker-lamp

FROM ubuntu:16.04
LABEL maintainer="Dr. Jamie Alnasir <jamie.alnasir@icr.ac.uk>"
LABEL description="Polyscope LAMP stack for Ubuntu 16.04 LTS, based on Github.com/fauria/docker-lamp. Includes .htaccess support and popular PHP7 features, including composer and mail() function." \
    License="Apache License 2.0" \
    Usage="docker run -d -p [HOST WWW PORT NUMBER]:80 -p [HOST DB PORT NUMBER]:3306 -v [HOST WWW DOCUMENT ROOT]:/var/www -v [HOST DB DOCUMENT ROOT]:/var/lib/mysql fauria/lamp" \
    Version="1.0"

RUN apt-get update
RUN apt-get upgrade -y

RUN apt-get install software-properties-common apt-transport-https ca-certificates wget -y

RUN gpg --keyserver hkp://keyserver.ubuntu.com --refresh-keys
RUN wget -O - https://apt.kitware.com/keys/kitware-archive-latest.asc 2>/dev/null | gpg --dearmor - | tee /etc/apt/trusted.gpg.d/kitware.gpg >/dev/null
RUN apt-add-repository "deb https://apt.kitware.com/ubuntu/ xenial main"

RUN apt-get update
RUN apt-get upgrade -y

COPY debconf.selections /tmp/
RUN debconf-set-selections /tmp/debconf.selections 

RUN apt-get install -y vim
RUN apt-get install -y zip unzip
RUN apt-get install -y \
    php7.0 \
    php7.0-bz2 \
    php7.0-cgi \
    php7.0-cli \
    php7.0-common \
    php7.0-curl \
    php7.0-dev \
    php7.0-enchant \
    php7.0-fpm \
    php7.0-gd \
    php7.0-gmp \
    php7.0-imap \
    php7.0-interbase \
    php7.0-intl \
    php7.0-json \
    php7.0-ldap \
    php7.0-mbstring \
    php7.0-mcrypt \
    php7.0-mysql \
    php7.0-odbc \
    php7.0-opcache \
    php7.0-pgsql \
    php7.0-phpdbg \
    php7.0-pspell \
    php7.0-readline \
    php7.0-recode \
    php7.0-snmp \
    php7.0-sqlite3 \
    php7.0-sybase \
    php7.0-tidy \
    php7.0-xmlrpc \
    php7.0-xsl \
    php7.0-zip
RUN apt-get install apache2 libapache2-mod-php7.0 -y
RUN apt-get install mariadb-common mariadb-server mariadb-client -y
RUN apt-get install postfix -y
RUN apt-get install composer nano tree vim curl ftp -y
RUN apt-get install htop -y
RUN apt-get install iperf -y
RUN apt-get install flex bison -y

# Remove old nodejs and npm if they are pre-installed
RUN apt-get purge -y nodejs npm

# Install Node.js (version 14 in this example) and npm
RUN curl -fsSL https://deb.nodesource.com/setup_14.x | bash - \
    && apt-get install -y --allow-unauthenticated nodejs

# Verify the installed versions
RUN node -v
RUN npm -v

# Install bower, grunt-cli, gulp globally
RUN npm install -g bower grunt-cli gulp

RUN apt-get install pmount -y
RUN apt-get install git subversion cvs -y

RUN apt-get install autoconf automake libtool pkg-config cmake -y
RUN apt-get install liblcms2-dev libtiff-dev libpng-dev libz-dev -y
RUN apt-get install libjpeg-dev liblzma-dev liblz-dev zlib1g-dev -y
RUN apt-get install libopenjpeg-dev libsqlite3-dev -y
RUN apt-get install libopencv-dev openjdk-8-jdk -y
RUN apt-get install cron -y
RUN apt-get install procmail -y
RUN apt-get install uuid-runtime -y
# Ensure upload directories exist and have proper permissions
# These lines in your Dockerfile should be changed to:
RUN mkdir -p /var/www/api
RUN mkdir -p /var/www/uploads
RUN chown -R www-data:www-data /var/www/uploads
RUN chmod -R 755 /var/www/api
RUN chmod -R 775 /var/www/uploads
# Add this to your Dockerfile
RUN mkdir -p /media/Users
RUN chown -R www-data:www-data /media/Users
RUN chmod -R 775 /media/Users
# Montage
RUN apt-get install imagemagick -y

# VIPS
RUN apt-get install gettext pkg-config swig gtk-doc-tools automake gobject-introspection make -y
RUN apt-get install libgtk2.0 -y
RUN apt-get install libvips-dev -y
RUN ln -s /usr/bin/vips /usr/local/bin/vips

RUN apt-get install snmp

ENV LOG_STDOUT=**Boolean**
ENV LOG_STDERR=**Boolean**
ENV LOG_LEVEL=warn
ENV ALLOW_OVERRIDE=All
ENV DATE_TIMEZONE=UTC
ENV TERM=dumb

# Change new /var/www/html default DocumentRoot to /var/html and set-up any
# configuration defaults and parameters
COPY ./apache-conf/*.conf /etc/apache2/sites-available/
COPY ./apache-conf/php.ini /etc/php/7.0/apache2/

# Add SSL configuration
RUN mkdir -p /etc/apache2/ssl
COPY ./ssl/polyscope.crt /etc/apache2/ssl/
COPY ./ssl/polyscope.key /etc/apache2/ssl/
RUN chmod 644 /etc/apache2/ssl/polyscope.crt
RUN chmod 600 /etc/apache2/ssl/polyscope.key

# Enable SSL module and site
RUN a2enmod ssl
RUN a2ensite default-ssl

# Add port 443 exposure
COPY index.php /var/www/
COPY run-lamp.sh /usr/sbin/

# Modified section with API directory copy
COPY ./jobs /var/www/jobs
COPY ./pz_scripts /var/www/pz_scripts
COPY ./assets /var/www/assets    
COPY *.html /var/www/
COPY *.php /var/www/
COPY *.sh /var/www/
COPY *.css /var/www/
COPY *.png /var/www/
COPY keys.txt /var/www/
COPY favicon.* /var/www/
COPY ./cron /var/www/cron
COPY ./docs /var/www/docs
COPY ./auth /var/www/auth  
COPY api/ /var/www/api/

# Set polyscope script file permissions
WORKDIR /var/www/
RUN chmod +x *.sh
RUN find . -type f -name '*.sh' -exec chmod +x {} \;

# Create necessary folders and empty logs
# RUN mkdir uploads
RUN touch uploads/upload.log
RUN printf '0'>counter.log
RUN printf '0'>jobCounter.log *
#RUN ./update-server.sh

# openslide (ntrahearn's fork with 4GB fix)
RUN git clone https://github.com/ntrahearn/openslide.git /root/openslide-master
WORKDIR /root/openslide-master
RUN autoreconf -i
RUN ./configure
RUN make
RUN make install
RUN apt-cache policy cmake

# libCZI requires CMake 3.15 or higher
RUN wget -P /root https://github.com/Kitware/CMake/releases/download/v3.20.0/cmake-3.20.0.tar.gz
WORKDIR /root
RUN tar -zvxf cmake-3.20.0.tar.gz
WORKDIR /root/cmake-3.20.0
RUN ./bootstrap
RUN make
RUN make install

RUN a2enmod rewrite

# Only create symbolic link if it does not already exist
RUN ln -sf /usr/bin/nodejs /usr/bin/node

RUN chmod +x /usr/sbin/run-lamp.sh
RUN chown -R www-data:www-data /var/www
RUN chmod -R g+w /var/www
RUN crontab -u www-data /var/www/cron/taskUpdate

VOLUME /var/www
VOLUME /var/log/httpd
VOLUME /var/lib/mysql
VOLUME /var/log/mysql
VOLUME /etc/apache2

EXPOSE 80
EXPOSE 3306
EXPOSE 443

ENV VIPSHOME="/usr/local"
ENV LD_LIBRARY_PATH="$LD_LIBRARY_PATH:$VIPSHOME/lib"
ENV PATH="$PATH:$VIPSHOME/bin"
ENV PKG_CONFIG_PATH="$PKG_CONFIG_PATH:$VIPSHOME/lib/pkgconfig"
ENV MANPATH="$MANPATH:$VIPSHOME/man"
ENV PYTHONPATH="$VIPSHOME/lib/python2.7/site-packages"

CMD ["/usr/sbin/run-lamp.sh"]
