# Mailprobe

Email testing library as fake inbox, useful for E2E and unittests 

---

Mailprobe runs a fake SMTP server to listen to the emails sent. It also runs a tiny webserver to display emails received.
For automation tests and unittests where the test cases need to check if certain email is received,
or to fetch email sent to a specific person can be checked via APIs.


## Installation

Mailprobe is an npm package, you can use npm to install.

  `$ npm install -g mailprobe`

## Running

Mailprobe runs SMTP server at standard port 25.
And runs the http server for serving webpages at 3000. 
This can be changed while running the mailprobe.

  `$ PORT=8000 mailprobe`

Now launch`http://localhost:8000/inbox` to see inbox.


## Requirements for Development

For development, you will only need Node.js and a node global package, Yarn, installed in your environement.

### Node
- #### Node installation on Windows

  Just go on [official Node.js website](https://nodejs.org/) and download the installer.
Also, be sure to have `git` available in your PATH, `npm` might need it (You can find git [here](https://git-scm.com/)).

- #### Node installation on Ubuntu

  You can install nodejs and npm easily with apt install, just run the following commands.

      $ sudo apt install nodejs
      $ sudo apt install npm

- #### Other Operating Systems
  You can find more information about the installation on the [official Node.js website](https://nodejs.org/) and the [official NPM website](https://npmjs.org/).

If the installation was successful, you should be able to run the following command.

    $ node --version
    v10.16.3

    $ npm --version
    6.9.0

If you need to update `npm`, you can make it using `npm`! Cool right? After running the following command, just open again the command line and be happy.

    $ npm install npm -g

###
### Yarn installation
  After installing node, this project will need yarn too, so just run the following command.

      $ npm install -g yarn

---

## Install

    $ git clone https://github.com/vkolgi/mailprobe
    $ cd mailprobe
    $ yarn install

## Running the project

    $ npm start

