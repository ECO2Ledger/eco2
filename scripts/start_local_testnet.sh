#!/usr/bin/env bash

PROG_NAME=$(basename $0)
PROG_DIR=$(readlink -m $(dirname $0))
ARGS="$@"
ARGC=$#

if [ $ARGC -lt 2 ]; then
  echo "Usage: $PROG_NAME <Number> <Base Path>"
  exit 1
fi

NODE_NUM=$1
shift
BASE_PATH=$1
shift

mkdir -p $BASE_PATH

PORT=`expr 30333 + $NODE_NUM`
WS_PORT=`expr 9944 + $NODE_NUM`
RPC_PORT=`expr 9933 + $NODE_NUM`

cmd="./target/release/eco2 \
  --base-path $BASE_PATH \
  --chain ./config/local-testnet.json \
  --port $PORT \
  --ws-port $WS_PORT \
  --rpc-port $RPC_PORT \
  --validator \
  --name 'Node$NODE_NUM'
  $@"
  
echo $cmd
nohup $cmd > $BASE_PATH/debug.log &