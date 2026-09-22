# Step by Step of how to setup Agronomad's WebApp in Raspberry Pi Zero 2W

1 - Install 64bit Pi os lite in Raspberry.
2 - Install Node.js(with prebuilt) and nvm(vers. >= 24).
3 - Install PostgreSql and Postgis.
4 - Install nginx

5 - Clone repository.
6 - Install modules with 'npm i'
7 - Build /client with 'npm run build'

8 - Create Agronomad DB and install postgis extension(as superuser).

9 - sudo cp deployment/nginx/agronomad.conf /etc/nginx/sites-available/agronomad
    sudo ln -s /etc/nginx/sites-available/agronomad /etc/nginx/sites-enabled/agronomad

10 - Delete default nginx service(at port 80). 

11 - Enable and start nginx service.
    sudo systemctl enable nginx
    sudo systemctl start nginx

12 - Give permissions to user www-data
    setfacl -m u:www-data:--x \
    /home/joa \
    /home/joa/Documents \
    /home/joa/Documents/AgroBotApp \
    /home/joa/Documents/AgroBotApp/client

    setfacl -R -m u:www-data:rX \
        /home/joa/Documents/AgroBotApp/client/dist