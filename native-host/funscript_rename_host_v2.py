#!/usr/bin/env python3
"""
Enhanced Native messaging host for Funscript Download Tracker Firefox extension.
Supports bidirectional communication and file system monitoring.
"""

import sys
import json
import struct
import os
import shutil
import logging
import threading
import time
import re
from pathlib import Path
from typing import Dict, List, Optional
import queue

# Set up logging
LOG_FILE = Path.home() / '.funscript_rename_host.log'
logging.basicConfig(
    filename=LOG_FILE,
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

class NativeMessagingHost:
    def __init__(self):
        self.message_queue = queue.Queue()
        self.running = True
        self.watched_directories = set()
        self.file_watchers = {}
        
    def get_message(self):
        """Read a message from stdin."""
        raw_length = sys.stdin.buffer.read(4)
        if len(raw_length) == 0:
            return None
        message_length = struct.unpack('@I', raw_length)[0]
        message = sys.stdin.buffer.read(message_length).decode('utf-8')
        return json.loads(message)
    
    def send_message(self, message_content):
        """Send a message to the extension."""
        encoded_content = json.dumps(message_content).encode('utf-8')
        encoded_length = struct.pack('@I', len(encoded_content))
        sys.stdout.buffer.write(encoded_length)
        sys.stdout.buffer.write(encoded_content)
        sys.stdout.buffer.flush()
    
    def rename_file(self, old_path, new_name):
        """Rename a file to a new name in the same directory."""
        try:
            old_path = Path(old_path)
            
            if not old_path.exists():
                return {
                    'success': False,
                    'error': f'File not found: {old_path}'
                }
            
            # Construct new path in same directory
            new_path = old_path.parent / new_name
            
            # Check if target already exists
            if new_path.exists() and new_path != old_path:
                return {
                    'success': False,
                    'error': f'Target file already exists: {new_path}'
                }
            
            # Perform the rename
            old_path.rename(new_path)
            
            logging.info(f'Successfully renamed {old_path} to {new_path}')
            
            # Notify extension of successful rename
            self.send_notification({
                'type': 'file_renamed',
                'old_path': str(old_path),
                'new_path': str(new_path),
                'timestamp': time.time()
            })
            
            return {
                'success': True,
                'old_path': str(old_path),
                'new_path': str(new_path)
            }
            
        except Exception as e:
            logging.error(f'Error renaming file: {e}')
            return {
                'success': False,
                'error': str(e)
            }
    
    def watch_directory(self, directory_path):
        """Start watching a directory for changes."""
        try:
            dir_path = Path(directory_path)
            if not dir_path.exists() or not dir_path.is_dir():
                return {
                    'success': False,
                    'error': f'Invalid directory: {directory_path}'
                }
            
            self.watched_directories.add(str(dir_path))
            
            # Start a watcher thread for this directory
            if str(dir_path) not in self.file_watchers:
                watcher_thread = threading.Thread(
                    target=self.directory_watcher,
                    args=(dir_path,),
                    daemon=True
                )
                self.file_watchers[str(dir_path)] = watcher_thread
                watcher_thread.start()
            
            return {
                'success': True,
                'watching': str(dir_path)
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def directory_watcher(self, directory: Path):
        """Watch a directory and notify about new files."""
        logging.info(f'Started watching directory: {directory}')
        last_files = set(directory.glob('*'))
        
        while self.running and str(directory) in self.watched_directories:
            try:
                time.sleep(2)  # Check every 2 seconds
                current_files = set(directory.glob('*'))
                
                # Check for new files
                new_files = current_files - last_files
                for file_path in new_files:
                    if file_path.is_file():
                        filename = file_path.name.lower()
                        # Check if it's a funscript or video file
                        if '.funscript' in filename or any(
                            filename.endswith(ext) for ext in 
                            ['.mp4', '.avi', '.mkv', '.webm', '.mov', '.wmv', '.flv', '.m4v', '.mpg', '.mpeg']
                        ):
                            self.send_notification({
                                'type': 'new_file_detected',
                                'path': str(file_path),
                                'filename': file_path.name,
                                'directory': str(directory),
                                'timestamp': time.time()
                            })
                            logging.info(f'Detected new file: {file_path}')
                
                # Check for deleted files
                deleted_files = last_files - current_files
                for file_path in deleted_files:
                    self.send_notification({
                        'type': 'file_deleted',
                        'path': str(file_path),
                        'filename': file_path.name,
                        'directory': str(directory),
                        'timestamp': time.time()
                    })
                    logging.info(f'Detected deleted file: {file_path}')
                
                last_files = current_files
                
            except Exception as e:
                logging.error(f'Error in directory watcher for {directory}: {e}')
    
    def send_notification(self, notification):
        """Queue a notification to be sent to the extension."""
        self.message_queue.put(notification)
    
    def get_base_name(self, filename):
        """Extract base name from filename by removing extensions."""
        base_name = filename
        
        # Remove funscript extensions (both patterns)
        funscript_patterns = [
            r'\.roll\.funscript$', r'\.twist\.funscript$', r'\.sway\.funscript$',
            r'\.surge\.funscript$', r'\.pitch\.funscript$', r'\.vib\.funscript$',
            r'\.stroke\.funscript$', r'\.lube\.funscript$', r'\.heat\.funscript$',
            r'\.funscript$'
        ]
        
        for pattern in funscript_patterns:
            base_name = re.sub(pattern, '', base_name, flags=re.IGNORECASE)
        
        # Remove video extensions
        video_extensions = ['.mp4', '.avi', '.mkv', '.wmv', '.mov', '.flv', '.webm', '.m4v']
        for ext in video_extensions:
            if base_name.lower().endswith(ext.lower()):
                base_name = base_name[:-len(ext)]
                break
        
        return base_name

    def move_files(self, files, destination, organize_in_subfolders=False):
        """Move multiple files to a destination folder."""
        try:
            dest_path = Path(destination)
            
            # Create destination directory if it doesn't exist
            if not dest_path.exists():
                dest_path.mkdir(parents=True, exist_ok=True)
                logging.info(f"Created destination directory: {destination}")
            
            if not dest_path.is_dir():
                return {
                    'success': False,
                    'error': f'Destination is not a directory: {destination}'
                }
            
            moved_files = []
            errors = []
            
            # First, validate ALL files before moving ANY
            # This ensures matched sets move together atomically
            video_files = [f for f in files if f.get('type') == 'video']
            funscript_files = [f for f in files if f.get('type') == 'funscript']
            
            # Check all video files first
            for video in video_files:
                source_path = Path(video['path'])
                if not source_path.exists():
                    errors.append(f"Video file not found: {video['path']}")
                    logging.error(f"Cannot move set - video missing: {video['path']}")
                    # If any video is missing or invalid, don't move anything
                    return {
                        'success': False,
                        'errors': errors,
                        'moved': [],
                        'destination': destination
                    }
                
                file_size = source_path.stat().st_size
                if file_size == 0:
                    errors.append(f"Video file is empty (0 bytes), likely still downloading: {video['path']}")
                    logging.warning(f"Cannot move set - video empty: {video['path']}")
                    # If any video is empty, don't move anything
                    return {
                        'success': False,
                        'errors': errors,
                        'moved': [],
                        'destination': destination
                    }
            
            # Now process all files since validation passed
            for file_info in files:
                try:
                    source_path = Path(file_info['path'])
                    if not source_path.exists():
                        errors.append(f"File not found: {file_info['path']}")
                        continue
                    
                    # Check if file size is non-zero (to avoid moving incomplete downloads)
                    file_size = source_path.stat().st_size
                    if file_size == 0:
                        errors.append(f"File is empty (0 bytes), likely still downloading: {file_info['path']}")
                        logging.warning(f"Skipping empty file: {file_info['path']}")
                        continue
                    
                    # For video files, perform additional stability check
                    if file_info.get('type') == 'video':
                        # Check file size stability (wait 1 second and check again)
                        import time
                        time.sleep(1)
                        new_size = source_path.stat().st_size
                        if new_size != file_size:
                            errors.append(f"File size changing, likely still downloading: {file_info['path']}")
                            logging.warning(f"Skipping file with changing size: {file_info['path']} ({file_size} -> {new_size} bytes)")
                            continue
                    
                    # Determine final destination path
                    if organize_in_subfolders:
                        # Create subdirectory based on base name
                        base_name = self.get_base_name(file_info['filename'])
                        subfolder_path = dest_path / base_name
                        subfolder_path.mkdir(parents=True, exist_ok=True)
                        dest_file = subfolder_path / source_path.name
                        logging.info(f"Creating/using subfolder: {subfolder_path}")
                    else:
                        # Move directly to destination folder
                        dest_file = dest_path / source_path.name
                    
                    # Handle existing files by adding a number suffix
                    if dest_file.exists():
                        base = dest_file.stem
                        ext = dest_file.suffix
                        counter = 1
                        while dest_file.exists():
                            dest_file = dest_path / f"{base}_{counter}{ext}"
                            counter += 1
                    
                    # Move the file
                    shutil.move(str(source_path), str(dest_file))
                    moved_files.append({
                        'original': str(source_path),
                        'new': str(dest_file),
                        'filename': file_info['filename']
                    })
                    logging.info(f"Moved file: {source_path} -> {dest_file}")
                    
                except Exception as e:
                    errors.append(f"Error moving {file_info['filename']}: {str(e)}")
                    logging.error(f"Error moving file {file_info['path']}: {e}")
            
            return {
                'success': len(errors) == 0,
                'moved': moved_files,
                'errors': errors if errors else None,
                'destination': destination
            }
            
        except Exception as e:
            logging.error(f"Error in move_files: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def select_folder(self):
        """Open a folder selection dialog."""
        try:
            # Try to use tkinter for folder selection
            try:
                import tkinter as tk
                from tkinter import filedialog
                
                # Create a temporary root window (hidden)
                root = tk.Tk()
                root.withdraw()  # Hide the main window
                root.attributes('-topmost', True)  # Keep dialog on top
                
                # Open folder selection dialog
                folder_path = filedialog.askdirectory(
                    title="Select folder",
                    initialdir=str(Path.home() / "Downloads")
                )
                
                root.destroy()  # Clean up
                
                if folder_path:
                    return {
                        'success': True,
                        'path': folder_path
                    }
                else:
                    return {
                        'success': False,
                        'error': 'Folder selection cancelled'
                    }
                    
            except ImportError:
                # Fallback: try zenity (Linux)
                try:
                    import subprocess
                    result = subprocess.run([
                        'zenity', '--file-selection', '--directory',
                        '--title=Select folder'
                    ], capture_output=True, text=True, timeout=60)
                    
                    if result.returncode == 0:
                        folder_path = result.stdout.strip()
                        return {
                            'success': True,
                            'path': folder_path
                        }
                    else:
                        return {
                            'success': False,
                            'error': 'Folder selection cancelled'
                        }
                except (subprocess.SubprocessError, FileNotFoundError):
                    pass
            
            # If all else fails
            return {
                'success': False,
                'error': 'No folder selection method available'
            }
            
        except Exception as e:
            logging.error(f"Error in select_folder: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def list_folders(self, base_folder):
        """List subdirectories in the base folder."""
        try:
            base_path = Path(base_folder)
            
            if not base_path.exists():
                return {
                    'success': False,
                    'error': f'Base folder does not exist: {base_folder}'
                }
            
            if not base_path.is_dir():
                return {
                    'success': False,
                    'error': f'Path is not a directory: {base_folder}'
                }
            
            folders = []
            for item in base_path.iterdir():
                if item.is_dir():
                    folders.append({
                        'name': item.name,
                        'path': str(item)
                    })
            
            # Sort folders by name
            folders.sort(key=lambda x: x['name'].lower())
            
            return {
                'success': True,
                'folders': folders,
                'baseFolder': base_folder
            }
            
        except Exception as e:
            logging.error(f"Error listing folders: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def move_single_file(self, file_info, destination_folder):
        """Move a single file to a destination folder without renaming."""
        try:
            source_path = Path(file_info['path'])
            dest_folder_path = Path(destination_folder)
            
            if not source_path.exists():
                return {
                    'success': False,
                    'error': f'Source file does not exist: {file_info["path"]}'
                }
            
            if not dest_folder_path.exists():
                return {
                    'success': False,
                    'error': f'Destination folder does not exist: {destination_folder}'
                }
            
            if not dest_folder_path.is_dir():
                return {
                    'success': False,
                    'error': f'Destination is not a directory: {destination_folder}'
                }
            
            # Keep original filename
            dest_file = dest_folder_path / source_path.name
            
            # Handle existing files by adding a number suffix
            if dest_file.exists():
                base = dest_file.stem
                ext = dest_file.suffix
                counter = 1
                while dest_file.exists():
                    dest_file = dest_folder_path / f"{base}_{counter}{ext}"
                    counter += 1
            
            # Move the file
            shutil.move(str(source_path), str(dest_file))
            
            logging.info(f"Moved single file: {source_path} -> {dest_file}")
            
            return {
                'success': True,
                'original': str(source_path),
                'new': str(dest_file),
                'filename': file_info['filename']
            }
            
        except Exception as e:
            logging.error(f"Error moving single file: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def scan_directory(self, directory_path):
        """Scan a directory and return all funscript and video files."""
        try:
            dir_path = Path(directory_path)
            if not dir_path.exists() or not dir_path.is_dir():
                return {
                    'success': False,
                    'error': f'Invalid directory: {directory_path}'
                }
            
            files = []
            video_extensions = ['.mp4', '.avi', '.mkv', '.webm', '.mov', '.wmv', '.flv', '.m4v', '.mpg', '.mpeg']
            
            for file_path in dir_path.iterdir():
                if file_path.is_file():
                    filename = file_path.name.lower()
                    if '.funscript' in filename:
                        files.append({
                            'path': str(file_path),
                            'filename': file_path.name,
                            'type': 'funscript',
                            'size': file_path.stat().st_size,
                            'modified': file_path.stat().st_mtime
                        })
                    elif any(filename.endswith(ext) for ext in video_extensions):
                        files.append({
                            'path': str(file_path),
                            'filename': file_path.name,
                            'type': 'video',
                            'size': file_path.stat().st_size,
                            'modified': file_path.stat().st_mtime
                        })
            
            return {
                'success': True,
                'directory': str(dir_path),
                'files': files
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def handle_message(self, message):
        """Process incoming messages from the extension."""
        try:
            action = message.get('action')
            
            if action == 'rename':
                old_path = message.get('oldPath')
                new_name = message.get('newName')
                
                if not old_path or not new_name:
                    return {
                        'success': False,
                        'error': 'Missing required parameters'
                    }
                
                return self.rename_file(old_path, new_name)
                
            elif action == 'watch':
                directory = message.get('directory')
                if not directory:
                    return {
                        'success': False,
                        'error': 'Missing directory parameter'
                    }
                return self.watch_directory(directory)
                
            elif action == 'unwatch':
                directory = message.get('directory')
                if directory in self.watched_directories:
                    self.watched_directories.remove(directory)
                return {
                    'success': True,
                    'unwatched': directory
                }
                
            elif action == 'scan':
                directory = message.get('directory')
                if not directory:
                    return {
                        'success': False,
                        'error': 'Missing directory parameter'
                    }
                return self.scan_directory(directory)
                
            elif action == 'move_files':
                files = message.get('files', [])
                destination = message.get('destination')
                
                logging.info(f'Move files request: {len(files)} files to {destination}')
                logging.debug(f'Files to move: {files}')
                
                if not files or not destination:
                    return {
                        'success': False,
                        'error': 'Missing files or destination'
                    }
                
                organize_in_subfolders = message.get('organizeInSubfolders', False)
                return self.move_files(files, destination, organize_in_subfolders)
                
            elif action == 'get_file_size':
                file_path = message.get('path')
                if not file_path:
                    return {
                        'success': False,
                        'error': 'Missing path parameter'
                    }
                
                try:
                    path = Path(file_path)
                    if path.exists() and path.is_file():
                        size = path.stat().st_size
                        return {
                            'success': True,
                            'size': size,
                            'path': file_path
                        }
                    else:
                        return {
                            'success': False,
                            'size': 0,
                            'error': 'File does not exist or is not a file',
                            'path': file_path
                        }
                except Exception as e:
                    return {
                        'success': False,
                        'size': 0,
                        'error': str(e),
                        'path': file_path
                    }
            
            elif action == 'ping':
                return {
                    'success': True,
                    'message': 'Native host is running (v2 with bidirectional support)',
                    'capabilities': ['rename', 'watch', 'scan', 'notifications', 'move_files', 'selectFolder', 'list_folders', 'move_single_file', 'get_file_size']
                }
            
            elif action == 'selectFolder':
                result = self.select_folder()
                # Add the response_to field for proper message correlation
                if 'id' in message:
                    result['response_to'] = message['id']
                return result
                
            elif action == 'list_folders':
                base_folder = message.get('baseFolder')
                if not base_folder:
                    return {
                        'success': False,
                        'error': 'Missing baseFolder parameter'
                    }
                result = self.list_folders(base_folder)
                if 'id' in message:
                    result['response_to'] = message['id']
                return result
                
            elif action == 'move_single_file':
                file_info = message.get('file')
                destination_folder = message.get('destinationFolder')
                
                if not file_info or not destination_folder:
                    return {
                        'success': False,
                        'error': 'Missing file or destinationFolder parameter'
                    }
                
                result = self.move_single_file(file_info, destination_folder)
                if 'id' in message:
                    result['response_to'] = message['id']
                return result
                
            else:
                return {
                    'success': False,
                    'error': f'Unknown action: {action}'
                }
                
        except Exception as e:
            logging.error(f'Error handling message: {e}')
            return {
                'success': False,
                'error': str(e)
            }
    
    def notification_sender(self):
        """Thread to send queued notifications to the extension."""
        while self.running:
            try:
                # Wait for notifications with timeout to allow checking self.running
                notification = self.message_queue.get(timeout=1)
                notification['source'] = 'native_host'
                self.send_message(notification)
                logging.debug(f'Sent notification: {notification}')
            except queue.Empty:
                continue
            except Exception as e:
                logging.error(f'Error sending notification: {e}')
    
    def run(self):
        """Main message loop."""
        logging.info('Native messaging host v2 started')
        
        # Start notification sender thread
        notification_thread = threading.Thread(target=self.notification_sender, daemon=True)
        notification_thread.start()
        
        while True:
            try:
                message = self.get_message()
                if message is None:
                    break
                    
                logging.debug(f'Received message: {message}')
                
                response = self.handle_message(message)
                response['response_to'] = message.get('id', 'unknown')
                logging.debug(f'Sending response: {response}')
                
                self.send_message(response)
                
            except Exception as e:
                logging.error(f'Fatal error in main loop: {e}')
                error_response = {
                    'success': False,
                    'error': f'Host error: {str(e)}'
                }
                try:
                    self.send_message(error_response)
                except:
                    pass
                break
        
        self.running = False
        logging.info('Native messaging host shutting down')

if __name__ == '__main__':
    host = NativeMessagingHost()
    host.run()