# Oracle Commerce Cloud Project Example

OCC storefront project structure example, should be used with [oracle-commerce-cli](https://github.com/eduardokeneeth/oracle-commerce-cli).

## Overview

This structure was created to make it easy develop with OCC. Using this structure + Oracle Commerce CLI you will be able to:

- Automatically upload your file at every file change;
- Auto refresh the browser after an upload is complete; 
- Manage TEST, STAGE and PROD environment with a single command;
- Create a widget or element;
- Transfer files between your environments;
- And more...

To see what you can do with Oracle Commerce Cloud CLI, [click here](https://github.com/eduardokeneeth/oracle-commerce-cli).

# Getting Started

## Installation

Download this repo [here](https://github.com/eduardokeneeth/oracle-commerce-project-example/releases) and copy everything, except README.md, to your repository. After this run the next command at your new project.

```sh
npm install
```

## Setup

At this point you shoud provide some informations to connect the CLI with your OCC instance, follow [this steps](https://github.com/eduardokeneeth/oracle-commerce-cli#getting-started) and you will be fine.

## Browsersync

This step is mandatory if you want to sync your browser with your file's changes.

**1.** After installing and setting your project, run `occ --dev`, this command will show you the following message:

```sh
[Browsersync] Copy the following snippet into your website, just before the closing </body> tag
<script id="__bs_script__">//<![CDATA[
    document.write("<script async src='https://HOST:3000/browser-sync/browser-sync-client.js?v=2.26.7'><\/script>".replace("HOST", location.hostname));
//]]></script>
```

**2.** You will copy the URL on `src` attribute from `script` tag and replace the word `HOST` to `localhost` and open it on your browser. The server created from Browsersync isn't certificated so you will need to authorize this access. After this you will be able to see a Javascript file.

**Note:** You will need to make this often, everytime you see that the request to this file failed it means that the access has expired and you need to authorize it again.