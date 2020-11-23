cmd_Release/midi.node := ln -f "Release/obj.target/midi.node" "Release/midi.node" 2>/dev/null || (rm -rf "Release/midi.node" && cp -af "Release/obj.target/midi.node" "Release/midi.node")
