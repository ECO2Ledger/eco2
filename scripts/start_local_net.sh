#!/bin/bash

readonly DIR=$(readlink -m $(dirname $0))

$DIR/start_local_validator.sh 1 target/tn1 --alice
$DIR/start_local_validator.sh 2 target/tn2 --bob
$DIR/start_local_validator.sh 3 target/tn3 --validator --name V3
$DIR/start_local_node.sh 0 target/tn0