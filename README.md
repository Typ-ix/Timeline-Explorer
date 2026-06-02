# Timeline Explorer

Timeline Explorer is a Splunk application, part of the OSIR Framework, designed to flag events and visualize them. Its purpose is to accelerate the work of cybersecurity teams by improving information sharing and reporting during investigations in Splunk.

## Features

- Event flagging and visualization
- Save your filter and manage visualization's profile 
- Enhanced information sharing capabilities

## Requirements

- **Splunk Version**: Tested on Splunk 9.X (Docker instances only)
- **Event Field**: All events must contain a `uid` field

## Installation

### Prerequisites

Ensure all events in your Splunk instance contain a `uid` field.

### Steps

1. **Download** the released `.tar.gz` file
2. **Install** the application in Splunk using the `.tar.gz` file
3. **Execute** `patch_splunk.sh` to enable flagging in "search" pages
4. **Restart** your Splunk master instance via the web UI

### Note

This application has been tested exclusively on Docker-based Splunk 9.X instances. Compatibility with other versions is not guaranteed. To adapt it to different Splunk versions, you must correct the paths in `patch_splunk.sh`.

For a seamless experience, we recommend using the **full OSIR installation**, which handles the setup of this application on Docker Splunk instances automatically.

## Basic Exemples

Timeline analysis features

![Demo](https://youtu.be/BMCD0gz0ojE)

Flag event in the search

![Demo](https://youtu.be/V7rgbpWxky0)

