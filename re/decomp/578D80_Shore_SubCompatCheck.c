bool __fastcall sub_578D80(int a1, unsigned int a2)
{
  if ( a1 >= dword_AA1020 && a1 < dword_AA1020 + 40 )
    return true;
  if ( a1 >= dword_AA073C && a1 < dword_AA073C + 4 )
  {
    if ( a1 == dword_AA073C || a1 == dword_AA073C + 3 )
      return a2 != 0 && a2 != 4;
    return true;
  }
  if ( a1 >= dword_ABB110 && a1 < dword_ABB110 + 4 )
  {
    if ( a1 == dword_ABB110 || a1 == dword_ABB110 + 3 )
      return a2 != 1 && a2 != 3;
    return true;
  }
  if ( a1 >= dword_AA1050 && a1 < dword_AA1050 + 4 )
  {
    if ( a1 == dword_AA1050 || a1 == dword_AA1050 + 3 )
      return a2 >= 2;
    return true;
  }
  if ( a1 >= dword_AA10A0 && a1 < dword_AA10A0 + 4 )
  {
    if ( a1 == dword_AA10A0 || a1 == dword_AA10A0 + 3 )
      return a2 != 2 && a2 != 3;
    return true;
  }
  return a1 >= dword_ABBEBC && a1 < dword_ABBEBC + 20;
}
