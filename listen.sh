filename=./data
script=compile.sh

inotifywait -mrq --format '%e' --event create,modify  $filename | while read event
  do
      bash $script
  done