#!/bin/bash

MAIN_ASSET="assets/road.mov"
MASK_ASSET="assets/mask_0.mov"

FILMBURN_INTERVAL=2
GRAIN_INTENSITY=25  # Adjust this value to change grain intensity (higher = more grain)

# Get the duration of the main asset to ensure output matches exactly
MAIN_DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $MAIN_ASSET)

get_filmburn_number() {
    echo $((RANDOM % 7))
}

# Create a complex filter that scales the main video first, then applies the mask
FILTER_COMPLEX="[0:v]scale=1920:1080[main];[main][1:v]overlay=0:0:shortest=1[base]"

# Add each filmburn effect with its own time window
for i in {0..2}; do
    FILMBURN_ASSET="assets/filmburn_${i}.mp4"
    # Calculate start and end times with gaps
    START_TIME=$((i * FILMBURN_INTERVAL * 2))  # Double the interval to create gaps
    END_TIME=$((START_TIME + FILMBURN_INTERVAL))  # Each effect plays for FILMBURN_INTERVAL seconds
    # Use setpts to control timing and ensure animation plays
    FILTER_COMPLEX+=";[$(($i+2)):v]setpts=PTS-STARTPTS+${START_TIME}/TB[fb${i}];[base][fb${i}]blend=all_mode=overlay:all_opacity=0.5:enable='between(t,${START_TIME},${END_TIME})'[base]"
done

# Add film grain effect
FILTER_COMPLEX+=";[base]noise=c0s=${GRAIN_INTENSITY}:c0f=t[grain]"

# Build the FFmpeg command with all inputs
FFMPEG_CMD="ffmpeg -i $MAIN_ASSET -stream_loop -1 -i $MASK_ASSET"
for i in {0..2}; do
    FFMPEG_CMD+=" -stream_loop -1 -i assets/filmburn_${i}.mp4"
done

# Add the filter complex and output with strict duration limit matching MAIN_ASSET
FFMPEG_CMD+=" -filter_complex \"$FILTER_COMPLEX\" -map \"[grain]\" -t $MAIN_DURATION -shortest output/output.mov"

# Execute the command
eval $FFMPEG_CMD