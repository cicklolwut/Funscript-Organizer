#!/usr/bin/env python3
"""
Native messaging host for Funscript Download Tracker Firefox extension.
Handles file renaming operations that the extension cannot perform directly.
"""

import sys
import json
import struct
import os
import shutil
import logging
import glob
from pathlib import Path

# Set up logging
LOG_FILE = Path.home() / '.funscript_rename_host.log'
logging.basicConfig(
    filename=LOG_FILE,
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def get_message():
    """Read a message from stdin."""
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) == 0:
        sys.exit(0)
    message_length = struct.unpack('@I', raw_length)[0]
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)

def encode_message(message_content):
    """Encode a message for sending to the extension."""
    encoded_content = json.dumps(message_content).encode('utf-8')
    encoded_length = struct.pack('@I', len(encoded_content))
    return {'length': encoded_length, 'content': encoded_content}

def send_message(message_content):
    """Send a message to the extension."""
    encoded_message = encode_message(message_content)
    sys.stdout.buffer.write(encoded_message['length'])
    sys.stdout.buffer.write(encoded_message['content'])
    sys.stdout.buffer.flush()

def rename_file(old_path, new_name):
    """
    Rename a file to a new name in the same directory.
    
    Args:
        old_path: Full path to the existing file
        new_name: New filename (not full path)
    
    Returns:
        dict: Result with success status and any error message
    """
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

def scan_directory(directory_path):
    """
    Scan a directory for funscript and video files.
    
    Args:
        directory_path: Path to directory to scan
    
    Returns:
        dict: Result with list of files found
    """
    try:
        directory = Path(directory_path)
        
        if not directory.exists() or not directory.is_dir():
            return {
                'success': False,
                'error': f'Directory not found or not accessible: {directory_path}'
            }
        
        # Define file extensions
        video_extensions = ['.mp4', '.avi', '.mkv', '.webm', '.mov', '.wmv', '.flv', '.m4v', '.mpg', '.mpeg']
        
        files = []
        
        # Scan for files
        for file_path in directory.iterdir():
            if file_path.is_file():
                filename = file_path.name
                full_path = str(file_path.absolute())
                
                # Check if it's a funscript file
                if filename.lower().endswith('.funscript'):
                    files.append({
                        'type': 'funscript',
                        'filename': filename,
                        'path': full_path,
                        'size': file_path.stat().st_size,
                        'id': full_path  # Use path as unique ID for scanned files
                    })
                
                # Check if it's a video file
                elif any(filename.lower().endswith(ext) for ext in video_extensions):
                    files.append({
                        'type': 'video',
                        'filename': filename,
                        'path': full_path,
                        'size': file_path.stat().st_size,
                        'id': full_path  # Use path as unique ID for scanned files
                    })
        
        logging.info(f'Scanned directory {directory_path}, found {len(files)} files')
        
        return {
            'success': True,
            'files': files,
            'directory': directory_path
        }
        
    except Exception as e:
        logging.error(f'Error scanning directory {directory_path}: {e}')
        return {
            'success': False,
            'error': str(e)
        }

def handle_message(message):
    """
    Process incoming messages from the extension.
    
    Message format:
    {
        'action': 'rename',
        'oldPath': '/full/path/to/file',
        'newName': 'newfilename.ext',
        'id': 'request_id'
    }
    """
    try:
        action = message.get('action')
        request_id = message.get('id')
        
        if action == 'rename':
            old_path = message.get('oldPath')
            new_name = message.get('newName')
            
            if not old_path or not new_name:
                result = {
                    'success': False,
                    'error': 'Missing required parameters'
                }
            else:
                result = rename_file(old_path, new_name)
            
            # Add response_to field if request had an ID
            if request_id:
                result['response_to'] = request_id
            
            return result
            
        elif action == 'ping':
            # Test connection
            result = {
                'success': True,
                'message': 'Native host is running'
            }
            
            # Add response_to field if request had an ID
            if request_id:
                result['response_to'] = request_id
            
            return result
            
        elif action == 'scan':
            # Scan directory for files
            directory = message.get('directory')
            
            if not directory:
                result = {
                    'success': False,
                    'error': 'Missing directory parameter'
                }
            else:
                result = scan_directory(directory)
            
            # Add response_to field if request had an ID
            if request_id:
                result['response_to'] = request_id
            
            return result
            
        elif action == 'watch':
            # For now, just acknowledge watch requests (could implement file watching later)
            result = {
                'success': True,
                'message': 'Directory watching acknowledged (not implemented)'
            }
            
            # Add response_to field if request had an ID
            if request_id:
                result['response_to'] = request_id
            
            return result
            
        elif action == 'unwatch':
            # For now, just acknowledge unwatch requests
            result = {
                'success': True,
                'message': 'Directory unwatching acknowledged (not implemented)'
            }
            
            # Add response_to field if request had an ID
            if request_id:
                result['response_to'] = request_id
            
            return result
            
        else:
            result = {
                'success': False,
                'error': f'Unknown action: {action}'
            }
            
            # Add response_to field if request had an ID
            if request_id:
                result['response_to'] = request_id
            
            return result
            
    except Exception as e:
        logging.error(f'Error handling message: {e}')
        result = {
            'success': False,
            'error': str(e)
        }
        
        # Add response_to field if request had an ID
        if message.get('id'):
            result['response_to'] = message.get('id')
        
        return result

def main():
    """Main message loop."""
    logging.info('Native messaging host started')
    
    while True:
        try:
            message = get_message()
            logging.debug(f'Received message: {message}')
            
            response = handle_message(message)
            logging.debug(f'Sending response: {response}')
            
            send_message(response)
            
        except Exception as e:
            logging.error(f'Fatal error in main loop: {e}')
            error_response = {
                'success': False,
                'error': f'Host error: {str(e)}'
            }
            try:
                send_message(error_response)
            except:
                pass
            sys.exit(1)

if __name__ == '__main__':
    main()