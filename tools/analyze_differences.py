#!/usr/bin/env python3
import csv
import ast

def analyze_semantic_differences(csv_file):
    """Analyze the semantic differences in the CSV file."""
    
    setscore_add_differences = []
    
    with open(csv_file, 'r') as f:
        reader = csv.reader(f)
        header = next(reader)
        
        for row in reader:
            move_id, difference_type, new_semantics_str, reference_semantics_str = row
            
            if difference_type == "setscore_add":
                # Parse the semantic dictionaries
                new_semantics = ast.literal_eval(new_semantics_str)
                reference_semantics = ast.literal_eval(reference_semantics_str)
                
                setscore_add_differences.append({
                    'move_id': move_id,
                    'new_setScore_add': new_semantics['setScore_add'],
                    'reference_setScore_add': reference_semantics['setScore_add'],
                    'new_semantics': new_semantics,
                    'reference_semantics': reference_semantics
                })
    
    return setscore_add_differences

def print_differences_analysis(differences, file_name):
    """Print analysis of the differences found."""
    
    print(f"\n=== Analysis of {file_name} ===")
    print(f"Total setScore_add differences: {len(differences)}")
    
    if differences:
        print("\nDetailed differences:")
        for diff in differences:
            print(f"Move {diff['move_id']}:")
            print(f"  New implementation: setScore_add = {diff['new_setScore_add']}")
            print(f"  Reference implementation: setScore_add = {diff['reference_setScore_add']}")
            
            # Show other semantic differences
            new_sem = diff['new_semantics']
            ref_sem = diff['reference_semantics']
            
            print(f"  Context:")
            print(f"    isCapture: {new_sem['isCapture']} vs {ref_sem['isCapture']}")
            print(f"    promotion: {new_sem['promotion']} vs {ref_sem['promotion']}")
            print(f"    setState: {new_sem['setState']} vs {ref_sem['setState']}")
            print(f"    enPassantSet: {new_sem['enPassantSet']} vs {ref_sem['enPassantSet']}")
            print(f"    enPassantReset: {new_sem['enPassantReset']} vs {ref_sem['enPassantReset']}")
            print()

if __name__ == "__main__":
    # Analyze both tournament files
    for i in [1, 2]:
        csv_file = f"semantic_report{i}.csv"
        try:
            differences = analyze_semantic_differences(csv_file)
            print_differences_analysis(differences, csv_file)
        except FileNotFoundError:
            print(f"File {csv_file} not found")
        except Exception as e:
            print(f"Error analyzing {csv_file}: {e}")
    
    # Also analyze the new test report
    try:
        differences = analyze_semantic_differences("semantic_report_new_test.csv")
        print_differences_analysis(differences, "semantic_report_new_test.csv")
    except FileNotFoundError:
        print(f"File semantic_report_new_test.csv not found")
    except Exception as e:
        print(f"Error analyzing semantic_report_new_test.csv: {e}")