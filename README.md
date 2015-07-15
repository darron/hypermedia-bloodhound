# Hypermedia Bloodhound

![bloodhound](https://raw.githubusercontent.com/codemoran/hypermedia-bloodhound/master/img/bloodhound.png)

# pre-requirements

The Hypermedia Bloodhound depends on libpcap, so if you are on linux, you need to install the package first (```sudo apt-get install libpcap-dev```), if you are on OSX 10.6+, you already have it.

We also depends on ```libgeoip``` for the IP address lookups, so ```sudo apt-get install libgeoip``` or ```brew install libgeoip``` on OSX.

# to get started

```
$ npm install
$ sudo node bin/bloodhound
```

# looking for help

```
$ node bin/bloodhound --help
```
