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
                
            elif action == 'ping':
                return {
                    'success': True,
                    'message': 'Native host is running (v2 with bidirectional support)',
                    'capabilities': ['rename', 'watch', 'scan', 'notifications']
                }
                
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